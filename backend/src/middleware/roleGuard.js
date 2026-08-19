function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: Requires one of [${allowedRoles.join(', ')}] roles`,
      });
    }

    next();
  };
}

module.exports = { requireRole };
