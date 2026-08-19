const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const otpService = require('../services/otpService');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';
const JWT_EXPIRATION = '24h';

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.email,
      userId: Number(user.id),
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
}

class AuthController {
  // POST /api/auth/send-otp
  async sendOtp(req, res, next) {
    try {
      const { email, phone } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }

      await otpService.generateAndSendOtp(email, phone);

      const msg = phone
        ? `OTP sent successfully to ${email} and SMS to ${phone}`
        : `OTP sent successfully to ${email}`;

      res.json({
        success: true,
        message: msg,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/auth/register
  async register(req, res, next) {
    try {
      const { name, email, password, phone, role, otp } = req.body;

      if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'Name, email, password, and role are required' });
      }

      const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }

      // Verify OTP via Redis
      const isValidOtp = await otpService.verifyOtp(email, otp);
      if (!isValidOtp) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: cleanPhone,
          role: role.toUpperCase(),
          enabled: true,
        },
      });

      const token = generateToken(user);

      res.json({
        success: true,
        message: 'User registered successfully',
        data: {
          token,
          userId: Number(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(400).json({ success: false, message: 'Bad credentials' });
      }

      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(400).json({ success: false, message: 'Bad credentials' });
      }

      if (!user.enabled) {
        return res.status(403).json({ success: false, message: 'Account is disabled' });
      }

      const token = generateToken(user);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          userId: Number(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
