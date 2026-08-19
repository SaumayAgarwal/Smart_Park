const { kafka } = require('../config/kafka');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { emitToOwner, emitToDriver } = require('../socket/socketHandler');

const consumer = kafka.consumer({ groupId: 'smartpark-notification-group' });

async function startConsumer() {
  try {
    await consumer.connect();
    console.log('✅ Apache Kafka Consumer connected (Group: smartpark-notification-group)');

    await consumer.subscribe({
      topics: ['smartpark.booking.events', 'smartpark.payment.events'],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const raw = message.value.toString();
          const parsed = JSON.parse(raw);
          const { eventType, data } = parsed;

          console.log(`[Kafka Consumer] 📥 Received [${topic}] -> ${eventType}`);

          switch (eventType) {
            case 'BOOKING_CONFIRMED': {
              const { booking, driver, spot, totalAmount } = data;

              // 1. Send HTML Confirmation Email
              if (driver && spot) {
                emailService.sendBookingConfirmationEmail(booking, driver, spot);
              }

              // 2. Real-time Socket.IO alert to owner
              if (spot?.owner?.email) {
                emitToOwner(spot.owner.email, 'NEW_BOOKING', {
                  type: 'NEW_BOOKING',
                  message: `Great news! You received a new booking for ${spot.title}`,
                  amount: totalAmount,
                });
              }

              // 3. SMS to Driver
              if (driver?.phone) {
                smsService.sendBookingConfirmedSms(driver.phone, {
                  bookingReference: booking.bookingReference,
                  spotTitle: spot.title,
                  startTime: booking.startTime,
                  endTime: booking.endTime,
                  amount: totalAmount,
                });
              }

              // 4. SMS to Space Owner
              if (spot?.owner?.phone) {
                smsService.sendNewBookingOwnerSms(spot.owner.phone, {
                  bookingReference: booking.bookingReference,
                  spotTitle: spot.title,
                  driverName: driver.name,
                  startTime: booking.startTime,
                  amount: totalAmount,
                });
              }
              break;
            }

            case 'EXTENSION_REQUESTED': {
              const { booking, ownerEmail, ownerPhone, driverName, spotTitle, hours } = data;
              if (ownerEmail) {
                emitToOwner(ownerEmail, 'EXTENSION_REQUESTED', {
                  type: 'EXTENSION_REQUESTED',
                  message: `Driver ${driverName} requested a +${hours}h extension on ${spotTitle}`,
                  bookingId: Number(booking.id),
                });
              }
              if (ownerPhone) {
                smsService.sendExtensionRequestOwnerSms(ownerPhone, {
                  bookingReference: booking.bookingReference,
                  spotTitle,
                  driverName,
                  extensionHours: hours,
                });
              }
              break;
            }

            case 'EXTENSION_APPROVED': {
              const { driverEmail, driverPhone, bookingReference, extraHours, bookingId } = data;
              if (driverEmail) {
                emitToDriver(driverEmail, 'EXTENSION_APPROVED', {
                  type: 'EXTENSION_APPROVED',
                  message: `Your extension request for +${extraHours}h was approved!`,
                  bookingId: Number(bookingId),
                });
              }
              if (driverPhone) {
                smsService.sendExtensionResponseSms(driverPhone, {
                  bookingReference,
                  approved: true,
                  extensionHours: extraHours,
                });
              }
              break;
            }

            case 'EXTENSION_DECLINED': {
              const { driverEmail, driverPhone, bookingReference, bookingId } = data;
              if (driverEmail) {
                emitToDriver(driverEmail, 'EXTENSION_DECLINED', {
                  type: 'EXTENSION_DECLINED',
                  message: `Your extension request was declined.`,
                  bookingId: Number(bookingId),
                });
              }
              if (driverPhone) {
                smsService.sendExtensionResponseSms(driverPhone, {
                  bookingReference,
                  approved: false,
                  extensionHours: 0,
                });
              }
              break;
            }

            case 'BOOKING_CANCELLED': {
              const { driverPhone, bookingReference, refundAmount } = data;
              if (driverPhone) {
                smsService.sendBookingCancelledSms(driverPhone, {
                  bookingReference,
                  refundAmount,
                });
              }
              break;
            }

            default:
              console.log(`[Kafka Consumer] Unhandled event type: ${eventType}`);
          }
        } catch (msgErr) {
          console.error('[Kafka Consumer] Error processing message:', msgErr.message);
        }
      },
    });
  } catch (err) {
    console.warn('⚠️ Kafka Consumer warning (will run in fallback mode if Kafka is offline):', err.message);
  }
}

module.exports = { startConsumer };
