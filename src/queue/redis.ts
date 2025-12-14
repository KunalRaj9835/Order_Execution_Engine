import * as IORedis from 'ioredis';

export const redisConnection = new IORedis.Redis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});
