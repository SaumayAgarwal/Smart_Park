const Redis = require('ioredis');

const redisHost = (process.env.REDIS_HOST || '127.0.0.1').replace(/^https?:\/\//, '');
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const useTls = process.env.REDIS_TLS === 'true' || redisHost.includes('upstash.io');

const redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  tls: useTls ? { rejectUnauthorized: false } : undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log(`Connected to Redis at ${redisHost}:${redisPort}`);
});

redis.on('error', (err) => {
  console.warn(`Redis connection warning: ${err.message}`);
});

module.exports = { redis };
