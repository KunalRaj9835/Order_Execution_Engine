import { Worker } from 'bullmq';
import { getRedis } from '../queue/redis.js';
import { DexRouter } from '../dex/dex.router.js';
import { sendUpdate } from '../websocket/ws.manager.js';
import { orderService } from '../db/order.service.js';
import { sleep } from '../utils/sleep.js';

const dexRouter = new DexRouter();

const worker = new Worker(
  'orders',
  async (job) => {
    const { orderId, tokenName, amount } = job.data;

    try {
      console.log(`\n🔄 Processing order ${orderId} for ${tokenName}`);

      // Stage 1: PENDING
      sendUpdate(orderId, {
        status: 'pending',
        orderId,
        tokenName,
        amount,
      });
      await sleep(500);

      // Stage 2: ROUTING
      console.log(`📡 Routing order ${orderId}...`);
      sendUpdate(orderId, { status: 'routing' });
      await orderService.updateOrderStatus(orderId, 'routing');

      const bestDex = await dexRouter.route(tokenName, amount);

      await orderService.updateOrderPrices(
        orderId,
        bestDex.raydiumPrice,
        bestDex.meteoraPrice,
        bestDex.dex
      );

      // Stage 3: BUILDING
      console.log(`🔨 Building transaction for order ${orderId} on ${bestDex.dex}...`);
      sendUpdate(orderId, {
        status: 'building',
        dex: bestDex.dex,
        raydiumPrice: bestDex.raydiumPrice,
        meteoraPrice: bestDex.meteoraPrice,
        chosenPrice: bestDex.price,
        priceDifference: bestDex.priceDifference,
        priceDifferencePercent: bestDex.priceDifferencePercent,
      });

      await orderService.updateOrderStatus(orderId, 'building', {
        dex: bestDex.dex,
        price: bestDex.price,
      });

      await sleep(1000);

      // Stage 4: SUBMITTED
      console.log(`📤 Submitting transaction for order ${orderId}...`);
      sendUpdate(orderId, { status: 'submitted' });
      await orderService.updateOrderStatus(orderId, 'submitted');
      await sleep(1500);

      // Stage 5: CONFIRMED
      const txHash = `tx_${Math.random().toString(36).slice(2, 15)}`;
      const executionPrice = bestDex.effectivePrice;

      console.log(`✅ Order ${orderId} confirmed!`);

      await orderService.createTransaction(
        orderId,
        bestDex.dex,
        executionPrice,
        txHash
      );

      sendUpdate(orderId, {
        status: 'confirmed',
        txHash,
        executionPrice,
        dex: bestDex.dex,
      });

      return {
        success: true,
        txHash,
        executionPrice,
        dex: bestDex.dex,
      };
    } catch (error) {
      console.error(`❌ Order ${orderId} failed:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await orderService.markOrderFailed(orderId, errorMessage);

      sendUpdate(orderId, {
        status: 'failed',
        error: errorMessage,
      });

      throw error;
    }
  },
  {
    connection: getRedis(), // ✅ shared + TLS-enabled
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 60000,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err.message);
});

worker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

console.log('🚀 Worker started and listening for jobs...');
