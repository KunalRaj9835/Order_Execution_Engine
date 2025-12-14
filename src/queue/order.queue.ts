import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';

export const orderQueue = new Queue('orders', {
  connection: redisConnection,
});
