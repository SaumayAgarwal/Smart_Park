const axios = require('axios');

/**
 * Fast2SMS Service
 * Docs: https://www.fast2sms.com/docs
 * Get your API key from: https://www.fast2sms.com/dashboard/developer
 */

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

/**
 * Send a plain text SMS to a single Indian mobile number.
 * @param {string} phone  - 10-digit Indian mobile number (without +91)
 * @param {string} message - SMS message text (max 160 chars for 1 SMS unit)
 */
async function sendSms(phone, message) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn('[SMS] FAST2SMS_API_KEY not set — skipping SMS');
    return;
  }

  const normalised = String(phone).replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);
  if (normalised.length !== 10) {
    console.warn(`[SMS] Invalid phone number: ${phone}`);
    return;
  }

  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: normalised,
      },
      {
        headers: { authorization: apiKey, 'Content-Type': 'application/json' },
        timeout: 8000,
      }
    );
    if (response.data?.return) {
      console.log(`[SMS] ✅ Sent to ${normalised}`);
    } else {
      console.warn(`[SMS] ⚠️ Fast2SMS:`, JSON.stringify(response.data));
    }
  } catch (err) {
    console.warn(`[SMS] ❌ Failed to ${normalised}:`, err.response?.data || err.message);
  }
}

// ─── Templated SMS senders ────────────────────────────────────────────────────

/**
 * Booking confirmation SMS to driver.
 */
async function sendBookingConfirmedSms(phone, { bookingReference, spotTitle, startTime, endTime, amount }) {
  const start = new Date(startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
  const end = new Date(endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', timeStyle: 'short' });
  const message =
    `SmartPark: Booking Confirmed!\n` +
    `Ref: ${bookingReference}\n` +
    `Spot: ${spotTitle}\n` +
    `Time: ${start} - ${end}\n` +
    `Amount: Rs.${amount}\n` +
    `Show QR pass at entry. -SmartPark`;
  return sendSms(phone, message);
}

/**
 * Booking cancellation SMS to driver.
 */
async function sendBookingCancelledSms(phone, { bookingReference, refundAmount }) {
  const refundMsg = refundAmount > 0
    ? `Refund of Rs.${refundAmount} credited to your SmartPark wallet.`
    : `No refund applicable.`;
  const message =
    `SmartPark: Booking ${bookingReference} has been cancelled.\n` +
    `${refundMsg}\n-SmartPark`;
  return sendSms(phone, message);
}

/**
 * New booking alert SMS to space owner.
 */
async function sendNewBookingOwnerSms(phone, { bookingReference, spotTitle, driverName, startTime, amount }) {
  const start = new Date(startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
  const message =
    `SmartPark: New booking on ${spotTitle}!\n` +
    `Ref: ${bookingReference}\n` +
    `Driver: ${driverName}\n` +
    `Start: ${start}\n` +
    `Earnings: Rs.${amount}\n-SmartPark`;
  return sendSms(phone, message);
}

/**
 * Extension request SMS to space owner.
 */
async function sendExtensionRequestOwnerSms(phone, { bookingReference, spotTitle, driverName, extensionHours }) {
  const message =
    `SmartPark: Extension request on ${spotTitle}!\n` +
    `Ref: ${bookingReference}\n` +
    `Driver ${driverName} requests +${extensionHours}h extension.\n` +
    `Login to approve or decline. -SmartPark`;
  return sendSms(phone, message);
}

/**
 * Extension approved/declined SMS to driver.
 */
async function sendExtensionResponseSms(phone, { bookingReference, approved, extensionHours }) {
  const status = approved ? 'APPROVED ✅' : 'DECLINED ❌';
  const message = approved
    ? `SmartPark: Your +${extensionHours}h extension for booking ${bookingReference} was ${status}. New end time updated. -SmartPark`
    : `SmartPark: Your extension request for booking ${bookingReference} was ${status}. Please vacate on time. -SmartPark`;
  return sendSms(phone, message);
}

/**
 * OTP SMS during registration/login.
 */
async function sendOtpSms(phone, otp) {
  const message = `${otp} is your SmartPark verification OTP. Valid for 5 minutes. Do not share. -SmartPark`;
  return sendSms(phone, message);
}

module.exports = {
  sendSms,
  sendBookingConfirmedSms,
  sendBookingCancelledSms,
  sendNewBookingOwnerSms,
  sendExtensionRequestOwnerSms,
  sendExtensionResponseSms,
  sendOtpSms,
};
