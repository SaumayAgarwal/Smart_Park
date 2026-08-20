const { sendEmail, fromEmail } = require('../config/mailer');
const smsService = require('./smsService');

const OTP_EXPIRATION_SECONDS = 300; // 5 minutes

class OtpService {
  async generateAndSendOtp(email, phone = null) {
    // 1. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save in Redis with 5-minute TTL
    const redisKey = `otp:register:${email}`;
    await redis.set(redisKey, otp, 'EX', OTP_EXPIRATION_SECONDS);

    // 3. Send SMS if phone is provided
    if (phone) {
      smsService.sendOtpSms(phone, otp).catch((e) => console.warn('[SMS OTP] Failed:', e.message));
    }

    // 4. Send email via Nodemailer in background (non-blocking for fast UI response)
    const mailOptions = {
      from: fromEmail,
      to: email,
      subject: 'SmartPark - Your Verification Code',
      text: `Welcome to SmartPark!\n\nYour verification OTP is: ${otp}\n\nThis OTP will expire in 5 minutes.\nPlease do not share this code with anyone.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 20px;">
          <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #e2e8f0;">
            <h2 style="color: #0d9488; margin-top: 0;">SmartPark Verification Code 🔐</h2>
            <p>Welcome to SmartPark! Use the verification code below to complete your registration:</p>
            <div style="background: #f0fdfa; border: 2px dashed #0d9488; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0d9488;">${otp}</span>
            </div>
            <p style="font-size: 0.85em; color: #64748b;">This OTP will expire in <strong>5 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    };

    // Dispatch email in background using sendEmail helper (HTTPS API + SMTP fallback)
    sendEmail({
      to: email,
      subject: 'SmartPark - Your Verification Code',
      text: mailOptions.text,
      html: mailOptions.html,
    });

    console.log(`🔑 Verification OTP [${otp}] generated for ${email}`);
  }

  async verifyOtp(email, providedOtp) {
    const redisKey = `otp:register:${email}`;
    const storedOtp = await redis.get(redisKey);

    if (storedOtp && storedOtp === providedOtp) {
      await redis.del(redisKey);
      return true;
    }
    return false;
  }
}

module.exports = new OtpService();
