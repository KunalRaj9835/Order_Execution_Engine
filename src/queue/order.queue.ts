import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export const orderQueue = new Queue('orders', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, 
      count: 100, 
    },
    removeOnFail: {
      age: 86400, 
    },
  },
});