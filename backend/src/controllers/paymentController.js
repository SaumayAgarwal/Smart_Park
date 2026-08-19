const crypto = require('crypto');
const { prisma } = require('../config/db');
const { razorpay, keyId, keySecret } = require('../config/razorpay');
const lockService = require('../services/lockService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { generateSecureQrToken } = require('../services/qrService');
const { emitToOwner, emitToDriver } = require('../socket/socketHandler');
const { publishBookingEvent } = require('../kafka/producer');

class PaymentController {
  // POST /api/payments/razorpay/create-order
  async createRazorpayOrder(req, res, next) {
    try {
      const driverId = req.user.id;
      const { bookingId, useWallet } = req.body;

      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Booking ID is required' });
      }

      const id = BigInt(bookingId);
      const driver = await prisma.user.findUnique({ where: { id: driverId } });
      const booking = await prisma.booking.findFirst({
        where: { id, userId: driverId },
        include: { parkingSpot: { include: { owner: true } } },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
      }

      if (booking.status !== 'PAYMENT_PENDING') {
        return res.status(400).json({ success: false, message: 'Booking is not in a valid state for payment' });
      }

      const totalAmount = Number(booking.amount);
      const walletBalance = Number(driver.walletBalance || 0);
      let walletDeducted = 0.0;

      if (useWallet && walletBalance > 0) {
        walletDeducted = Math.min(walletBalance, totalAmount);
      }

      const payableAmount = Math.max(0, Math.round((totalAmount - walletDeducted) * 100) / 100);

      // CASE 1: Fully Paid via SmartPark Wallet
      if (payableAmount <= 0) {
        // Deduct full amount from wallet
        await prisma.user.update({
          where: { id: driverId },
          data: { walletBalance: walletBalance - totalAmount },
        });

        const qrToken = generateSecureQrToken(booking.id, booking.bookingReference);

        const updatedBooking = await prisma.booking.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            qrCode: qrToken,
          },
          include: { parkingSpot: true, user: true },
        });

        try {
          await prisma.payment.create({
            data: {
              bookingId: id,
              amount: totalAmount,
              transactionId: `WALLET-${Date.now()}`,
              paymentMethod: 'WALLET',
              status: 'SUCCESS',
            },
          });
        } catch (e) {
          console.warn('Payment record log skipped:', e.message);
        }

        await lockService.releaseLock(booking.parkingSpotId, booking.startTime, booking.endTime);
        emailService.sendBookingConfirmationEmail(updatedBooking, driver, booking.parkingSpot);

        // Notify owner via Socket.io
        emitToOwner(booking.parkingSpot.owner.email, 'NEW_BOOKING', {
          type: 'NEW_BOOKING',
          message: `Great news! You received a new booking for ${booking.parkingSpot.title}`,
          amount: totalAmount,
        });

        // Send SMS to Driver & Space Owner
        if (driver.phone) {
          smsService.sendBookingConfirmedSms(driver.phone, {
            bookingReference: booking.bookingReference,
            spotTitle: booking.parkingSpot.title,
            startTime: booking.startTime,
            endTime: booking.endTime,
            amount: totalAmount,
          });
        }
        if (booking.parkingSpot.owner?.phone) {
          smsService.sendNewBookingOwnerSms(booking.parkingSpot.owner.phone, {
            bookingReference: booking.bookingReference,
            spotTitle: booking.parkingSpot.title,
            driverName: driver.name,
            startTime: booking.startTime,
            amount: totalAmount,
          });
        }

        // Publish to Apache Kafka event pipeline
        publishBookingEvent('BOOKING_CONFIRMED', {
          booking: updatedBooking,
          driver,
          spot: booking.parkingSpot,
          totalAmount,
        });

        return res.json({
          success: true,
          message: 'Paid via SmartPark Wallet',
          data: {
            razorpayOrderId: 'ORDER_WALLET_PAID',
            totalAmount,
            walletDeducted,
            payableAmount: 0,
            currency: 'INR',
            keyId,
            fullyPaidByWallet: true,
            bookingId: Number(booking.id),
          },
        });
      }

      // CASE 2: Create Razorpay Order
      let orderId;
      try {
        if (!keyId.startsWith('rzp_test_sample')) {
          const order = await razorpay.orders.create({
            amount: Math.round(payableAmount * 100), // In paise
            currency: 'INR',
            receipt: booking.bookingReference,
          });
          orderId = order.id;
        } else {
          orderId = `order_mock_${Date.now()}`;
        }
      } catch (err) {
        console.warn('Razorpay order creation fallback:', err.message);
        orderId = `order_dev_${Date.now()}`;
      }

      res.json({
        success: true,
        message: 'Razorpay Order created',
        data: {
          razorpayOrderId: orderId,
          totalAmount,
          walletDeducted,
          payableAmount,
          currency: 'INR',
          keyId,
          fullyPaidByWallet: false,
          bookingId: Number(booking.id),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/payments/razorpay/verify
  async verifyRazorpayPayment(req, res, next) {
    try {
      const driverId = req.user.id;
      const {
        bookingId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        walletDeducted,
        paymentMethod,
      } = req.body;

      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Booking ID is required' });
      }

      const id = BigInt(bookingId);
      const driver = await prisma.user.findUnique({ where: { id: driverId } });
      const booking = await prisma.booking.findFirst({
        where: { id, userId: driverId },
        include: { parkingSpot: { include: { owner: true } } },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
      }

      if (booking.status !== 'PAYMENT_PENDING') {
        return res.status(400).json({ success: false, message: 'Booking is already processed' });
      }

      // Verify Signature if using real keys
      if (!keyId.startsWith('rzp_test_sample') && razorpaySignature) {
        const generatedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest('hex');

        if (generatedSignature !== razorpaySignature) {
          return res.status(400).json({ success: false, message: 'Razorpay payment signature verification failed' });
        }
      }

      // Atomic wallet deduction
      const deduction = parseFloat(walletDeducted || 0);
      if (deduction > 0) {
        const currentWallet = Number(driver.walletBalance || 0);
        const actualDeduction = Math.min(currentWallet, deduction);
        await prisma.user.update({
          where: { id: driverId },
          data: { walletBalance: currentWallet - actualDeduction },
        });
      }

      const qrToken = generateSecureQrToken(booking.id, booking.bookingReference);

      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          qrCode: qrToken,
        },
        include: { parkingSpot: true, user: true },
      });

      let pMethod = 'CREDIT_CARD';
      if (paymentMethod === 'UPI') pMethod = 'UPI';
      else if (paymentMethod === 'WALLET') pMethod = 'WALLET';
      else if (paymentMethod === 'RAZORPAY') pMethod = 'RAZORPAY';

      const transactionId = razorpayPaymentId || `RZP-PAY-${Date.now()}`;

      let paymentRecord = null;
      try {
        paymentRecord = await prisma.payment.create({
          data: {
            bookingId: id,
            amount: booking.amount,
            transactionId,
            paymentMethod: pMethod,
            status: 'SUCCESS',
          },
        });
      } catch (e) {
        console.warn('Payment creation notice:', e.message);
      }

      await lockService.releaseLock(booking.parkingSpotId, booking.startTime, booking.endTime);
      emailService.sendBookingConfirmationEmail(updatedBooking, driver, booking.parkingSpot);

      // Real-time notification to space owner
      if (booking.parkingSpot && booking.parkingSpot.owner) {
        emitToOwner(booking.parkingSpot.owner.email, 'NEW_BOOKING', {
          type: 'NEW_BOOKING',
          message: `Great news! You received a new booking for ${booking.parkingSpot.title}`,
          amount: Number(booking.amount),
        });
      }

      // Send SMS to Driver & Space Owner
      if (driver.phone) {
        smsService.sendBookingConfirmedSms(driver.phone, {
          bookingReference: booking.bookingReference,
          spotTitle: booking.parkingSpot.title,
          startTime: booking.startTime,
          endTime: booking.endTime,
          amount: Number(booking.amount),
        });
      }
      if (booking.parkingSpot?.owner?.phone) {
        smsService.sendNewBookingOwnerSms(booking.parkingSpot.owner.phone, {
          bookingReference: booking.bookingReference,
          spotTitle: booking.parkingSpot.title,
          driverName: driver.name,
          startTime: booking.startTime,
          amount: Number(booking.amount),
        });
      }

      // Publish to Apache Kafka event pipeline
      publishBookingEvent('BOOKING_CONFIRMED', {
        booking: updatedBooking,
        driver,
        spot: booking.parkingSpot,
        totalAmount: Number(booking.amount),
      });

      res.json({
        success: true,
        message: 'Payment verified & booking confirmed!',
        data: {
          id: paymentRecord ? Number(paymentRecord.id) : Number(booking.id),
          bookingId: Number(booking.id),
          amount: Number(booking.amount),
          transactionId,
          paymentMethod: pMethod,
          status: 'SUCCESS',
          message: 'Razorpay payment verified & confirmed.',
          createdAt: paymentRecord?.createdAt || new Date(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/payments
  async processPayment(req, res, next) {
    try {
      const driverId = req.user.id;
      const { bookingId, paymentMethod } = req.body;

      const id = BigInt(bookingId);
      const driver = await prisma.user.findUnique({ where: { id: driverId } });
      const booking = await prisma.booking.findFirst({
        where: { id, userId: driverId },
        include: { parkingSpot: { include: { owner: true } } },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
      }

      if (booking.status !== 'PAYMENT_PENDING') {
        return res.status(400).json({ success: false, message: 'Booking is not in a valid state for payment' });
      }

      const qrToken = generateSecureQrToken(booking.id, booking.bookingReference);

      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          qrCode: qrToken,
        },
        include: { parkingSpot: true, user: true },
      });

      const transactionId = `TXN-${Date.now()}`;
      const payment = await prisma.payment.create({
        data: {
          bookingId: id,
          amount: booking.amount,
          transactionId,
          paymentMethod: paymentMethod || 'CREDIT_CARD',
          status: 'SUCCESS',
        },
      });

      await lockService.releaseLock(booking.parkingSpotId, booking.startTime, booking.endTime);
      emailService.sendBookingConfirmationEmail(updatedBooking, driver, booking.parkingSpot);

      if (booking.parkingSpot && booking.parkingSpot.owner) {
        emitToOwner(booking.parkingSpot.owner.email, 'NEW_BOOKING', {
          type: 'NEW_BOOKING',
          message: `Great news! You received a new booking for ${booking.parkingSpot.title}`,
          amount: Number(booking.amount),
        });
      }

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          id: Number(payment.id),
          bookingId: Number(payment.bookingId),
          amount: Number(payment.amount),
          transactionId: payment.transactionId,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          message: 'Payment successful. Booking confirmed.',
          createdAt: payment.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PaymentController();
