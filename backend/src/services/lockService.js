const { redis } = require('../config/redis');

// Lock is held only for the duration of the DB transaction (~5 seconds)
// to prevent two concurrent requests from passing the overlap check simultaneously.
const LOCK_EXPIRATION_SECONDS = 10;

class LockService {
  /**
   * Acquires a spot-level lock to prevent race conditions during overlap checks.
   * Key: "lock:spot:{spotId}" — one lock per spot, not per time range.
   * Uses a unique token so only the holder can release it.
   */
  async acquireLock(spotId) {
    try {
      const lockKey = `lock:spot:${spotId}`;
      const token = `${Date.now()}:${Math.random()}`;

      // SET lockKey token EX 10 NX  — atomic acquire
      const result = await redis.set(lockKey, token, 'EX', LOCK_EXPIRATION_SECONDS, 'NX');
      if (result !== 'OK') return null; // lock already held
      return { lockKey, token };
    } catch (err) {
      console.warn('Redis lock warning (proceeding without lock):', err.message);
      return { lockKey: null, token: null }; // Graceful fallback if Redis offline
    }
  }

  /**
   * Releases the spot-level lock only if the token matches (safe release).
   */
  async releaseLock(lockHandle) {
    if (!lockHandle || !lockHandle.lockKey) return;
    try {
      const current = await redis.get(lockHandle.lockKey);
      if (current === lockHandle.token) {
        await redis.del(lockHandle.lockKey);
      }
    } catch (err) {
      console.warn('Redis release lock warning:', err.message);
    }
  }
}

module.exports = new LockService();
