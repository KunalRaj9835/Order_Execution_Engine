
import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL missing at runtime');
    }

    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      tls: {
        rejectUnauthorized: false,
      },
    });

    redis.on('ready', () => {
      console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });
  }

  return redis;
}
