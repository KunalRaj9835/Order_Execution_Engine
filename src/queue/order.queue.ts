import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const orderQueue = new Queue('orders', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 60 * 60, // 1 hour
      count: 100,
    },
    removeOnFail: {
      age: 24 * 60 * 60, // 24 hours
    },
  },
});
