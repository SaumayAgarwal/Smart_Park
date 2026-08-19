const crypto = require('crypto');

function generateSecureQrToken(bookingId, bookingReference) {
  const payload = `${bookingId}:${bookingReference}:${Date.now()}`;
  return crypto.createHash('sha256').update(payload).digest('hex').substring(0, 32);
}

module.exports = { generateSecureQrToken };
