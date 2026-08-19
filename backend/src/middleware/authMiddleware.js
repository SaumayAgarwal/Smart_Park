const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: Missing or malformed authorization token',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.sub || decoded.email || decoded.username;

    if (!email) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.enabled) {
      return res.status(403).json({ success: false, message: 'User account is disabled' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
}

module.exports = { authenticateToken };
