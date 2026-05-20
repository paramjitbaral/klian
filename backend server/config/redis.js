// Redis client setup using ioredis
// Supports: plain host/port/password OR a full REDIS_URL (Upstash)
const Redis = require('ioredis');

let redis;

function getRedis() {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL; // e.g. rediss://:password@host:port
  if (redisUrl) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  } else {
    redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // recommended for socket.io adapter if used
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }

  redis.on('connect', () => console.log('Redis connected'));
  redis.on('error', (err) => console.error('Redis error:', err.message));
  return redis;
}

module.exports = { getRedis };
