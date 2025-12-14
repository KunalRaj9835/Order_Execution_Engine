import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { orderQueue } from '../queue/order.queue.js';
import { registerClient, sendUpdate } from '../websocket/ws.manager.js';
import { orderService } from '../db/order.service.js';

// Mock token names for demo
const TOKEN_NAMES = ['SOL/USDC', 'BONK/SOL', 'JUP/USDC', 'ORCA/SOL', 'RAY/USDC'];

export async function orderRoutes(app: FastifyInstance) {
  // POST endpoint to submit order
  app.post('/api/orders/execute', async (req, reply) => {
    try {
      const body = req.body as any;
      const amount = body?.amount || 1000;
      const tokenName = body?.tokenName || TOKEN_NAMES[Math.floor(Math.random() * TOKEN_NAMES.length)];

      const orderId = uuid();

      console.log(`\n📥 New order received:`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Token: ${tokenName}`);
      console.log(`   Amount: ${amount}\n`);

      // Create order in database
      await orderService.createOrder(orderId, tokenName, amount);

      // Add job to queue
      await orderQueue.add('execute', { orderId, tokenName, amount }, {
        jobId: orderId, // Use orderId as jobId for easy lookup
      });

      // Send initial pending status
      sendUpdate(orderId, { 
        status: 'pending', 
        orderId,
        tokenName,
        amount 
      });

      return { 
        orderId, 
        tokenName,
        amount,
        message: 'Order queued successfully',
        websocketUrl: `/api/orders/ws?orderId=${orderId}`
      };
    } catch (error) {
      console.error('❌ Error submitting order:', error);
      reply.status(500).send({ 
        error: 'Failed to submit order',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // WebSocket endpoint for real-time updates
  app.get('/api/orders/ws', { websocket: true }, (socket, req) => {
    const query = req.query as any;
    const orderId = query.orderId;

    if (!orderId) {
      socket.send(JSON.stringify({ error: 'orderId is required' }));
      socket.close();
      return;
    }

    console.log(`📡 WebSocket connected for order ${orderId}`);
    registerClient(orderId, socket);

    // Send initial connection confirmation
    socket.send(JSON.stringify({ 
      message: 'Connected to order updates',
      orderId 
    }));

    socket.on('close', () => {
      console.log(`📡 WebSocket disconnected for order ${orderId}`);
    });

    socket.on('error', (err) => {
      console.error(`❌ WebSocket error for order ${orderId}:`, err);
    });
  });

  // Get order details with full history
  app.get('/api/orders/:orderId', async (req, reply) => {
    const { orderId } = req.params as any;
    
    try {
      const order = await orderService.getOrder(orderId);
      const events = await orderService.getOrderEvents(orderId);
      const transactions = await orderService.getOrderTransactions(orderId);
      
      return {
        order,
        events,
        transactions,
      };
    } catch (error) {
      console.error('❌ Error fetching order:', error);
      reply.status(404).send({ 
        error: 'Order not found',
        orderId 
      });
    }
  });

  // Get all orders (with pagination)
  app.get('/api/orders', async (req, reply) => {
    try {
      const query = req.query as any;
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');
      const offset = (page - 1) * limit;

      const { data, error, count } = await orderService.supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        orders: data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      reply.status(500).send({ 
        error: 'Failed to fetch orders' 
      });
    }
  });

  // Get order events for a specific order
  app.get('/api/orders/:orderId/events', async (req, reply) => {
    const { orderId } = req.params as any;
    
    try {
      const events = await orderService.getOrderEvents(orderId);
      return { orderId, events };
    } catch (error) {
      console.error('❌ Error fetching order events:', error);
      reply.status(404).send({ 
        error: 'Order events not found',
        orderId 
      });
    }
  });
}

// Add to orderService if not already there
declare module '../db/order.service.js' {
  interface OrderService {
    supabase: any;
  }
}