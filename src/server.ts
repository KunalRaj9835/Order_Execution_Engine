import 'dotenv/config';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { orderRoutes } from './routes/order.routes.js';

const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  },
});


await app.register(cors, {
  origin: true, 
});

await app.register(websocket);
await app.register(orderRoutes);


app.get('/health', async () => {
  return { 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'order-execution-engine'
  };
});


app.get('/', async () => {
  return {
    message: 'Order Execution Engine API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      submitOrder: 'POST /api/orders/execute',
      orderWebSocket: 'WS /api/orders/ws?orderId={orderId}',
      getOrder: 'GET /api/orders/:orderId',
      getAllOrders: 'GET /api/orders',
      getOrderEvents: 'GET /api/orders/:orderId/events',
    },
  };
});


const startServer = async () => {
  try {
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

   
    await import('./queue/order.worker.js');
    
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    console.log('\n🚀 Order Execution Engine Started!');
    console.log(`📡 Server running on http://${host}:${port}`);
    console.log(`💾 Database: Connected to Supabase`);
    console.log(`🔴 Redis: Connected`);
    console.log(`👷 Worker: Initialized and ready\n`);
    
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();