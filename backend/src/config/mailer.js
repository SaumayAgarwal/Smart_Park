const nodemailer = require('nodemailer');

const mailUser = process.env.MAIL_USERNAME || 'neeteshsingh660@gmail.com';
const rawPass = process.env.MAIL_PASSWORD || 'plpl pclc ursp aqic';
const mailPass = rawPass ? rawPass.replace(/\s+/g, '') : '';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: mailUser,
    pass: mailPass,
  },
});

// Verify SMTP connection on boot
transporter.verify((error) => {
  if (error) {
    console.warn('⚠️ SMTP Transporter configuration warning:', error.message);
  } else {
    console.log('✅ Nodemailer Gmail SMTP Transporter ready to send emails');
  }
});

module.exports = { transporter, fromEmail: mailUser };
