const axios = require('axios');
const nodemailer = require('nodemailer');

const mailUser = process.env.MAIL_USERNAME || 'neeteshsingh660@gmail.com';
const rawPass = process.env.MAIL_PASSWORD || 'plpl pclc ursp aqic';
const mailPass = rawPass ? rawPass.replace(/\s+/g, '') : '';
const resendApiKey = process.env.RESEND_API_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: mailUser,
    pass: mailPass,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 5000,
});

async function sendEmail({ to, subject, html, text }) {
  // 1. Try Brevo HTTPS API (Port 443 - Never blocked on Render)
  if (brevoApiKey) {
    try {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: 'SmartPark', email: mailUser },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        },
        { headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' }, timeout: 8000 }
      );
      console.log(`✅ Email sent via Brevo HTTPS to ${to}`);
      return;
    } catch (e) {
      console.warn('[Brevo HTTPS Email] Warning:', e.response?.data || e.message);
    }
  }

  // 2. Try Resend HTTPS API (Port 443 - Never blocked on Render)
  if (resendApiKey) {
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: 'SmartPark <onboarding@resend.dev>',
          to: [to],
          subject,
          html,
        },
        { headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' }, timeout: 8000 }
      );
      console.log(`✅ Email sent via Resend HTTPS to ${to}`);
      return;
    } catch (e) {
      console.warn('[Resend HTTPS Email] Warning:', e.response?.data || e.message);
    }
  }

  // 3. Fallback to Nodemailer SMTP
  try {
    await transporter.sendMail({ from: mailUser, to, subject, html, text });
    console.log(`✅ Email sent via SMTP to ${to}`);
  } catch (err) {
    console.warn(`⚠️ SMTP delivery notice (${err.message}). Check Render logs for OTP code.`);
  }
}

module.exports = { transporter, fromEmail: mailUser, sendEmail };
