import { connection } from '../dex/solana.js';
import { Worker } from 'bullmq';
import { redisConnection } from './redis.js';
import { chooseBest } from '../dex/router.js';
import { raydiumQuote, raydiumExecute } from '../dex/raydium.adapter.js';
import { meteoraQuote } from '../dex/meteora.adapter.js';
import { sendUpdate } from '../websocket/ws.manager.js';
import { withTimeout } from '../utils/withTimeout.js';
import { supabase } from '../db/supabase.js';

export const orderWorker = new Worker(
  'orders',
  async job => {
    const { orderId, amount } = job.data;

    console.log(`\n🔄 Processing order ${orderId}`);
    
    // Update database: routing
    const { error: routingError } = await supabase
      .from('orders')
      .update({ status: 'routing' })
      .eq('id', orderId);
    
    if (routingError) {
      console.error('❌ Database update failed (routing):', routingError);
    }
    
    sendUpdate(orderId, { status: 'routing' });

    const quotes = [];
    let rayCtx;

    // Get Raydium quote
    try {
      console.log('📊 Fetching Raydium quote...');
      rayCtx = await withTimeout(
        raydiumQuote(process.env.RAYDIUM_POOL_ID!, amount),
        5000
      );
      quotes.push({
        dex: 'raydium',
        amountOut: rayCtx.amountOut,
      });
      console.log('✅ Raydium quote:', rayCtx.amountOut.toString());
    } catch (e: any) {
      console.error('❌ Raydium quote failed:', e.message);
    }

    // Get Meteora quote
    try {
      console.log('📊 Fetching Meteora quote...');
      const met = await withTimeout(
        meteoraQuote(process.env.METEORA_POOL_ID!, amount * 1e9),
        5000
      );
      quotes.push(met);
      console.log('✅ Meteora quote:', met.amountOut.toString());
    } catch (e: any) {
      console.warn('⚠️  Meteora quote unavailable:', e.message);
    }

    if (quotes.length === 0) {
      const { error: failError } = await supabase
        .from('orders')
        .update({ 
          status: 'failed'
        })
        .eq('id', orderId);
      
      if (failError) {
        console.error('❌ Database update failed (no quotes):', failError);
      }
      
      sendUpdate(orderId, { 
        status: 'failed', 
        error: 'No valid quotes from any DEX' 
      });
      
      throw new Error('No valid quotes from any DEX');
    }

    const best = chooseBest(quotes);
    console.log(`🏆 Best DEX: ${best.dex} with output ${best.amountOut}`);

    // Calculate prices for both DEXs
    const inputInBaseUnits = amount * 1e9;
    const raydiumPrice = rayCtx ? Number(rayCtx.amountOut) / inputInBaseUnits : null;
    const meteoraPrice = quotes.find(q => q.dex === 'meteora') 
      ? Number(quotes.find(q => q.dex === 'meteora')!.amountOut) / inputInBaseUnits 
      : null;
    const executionPrice = Number(best.amountOut) / inputInBaseUnits;
    
    console.log(`💰 Execution price: ${executionPrice}`);

    // Update database: building - USE CORRECT COLUMN NAMES
    const { error: buildingError } = await supabase
      .from('orders')
      .update({ 
        status: 'building',
        chosen_dex: best.dex,           // ← Changed from 'dex'
        raydium_price: raydiumPrice,    // ← Use raydium_price
        meteora_price: meteoraPrice,    // ← Use meteora_price
        execution_price: executionPrice // ← Use execution_price
      })
      .eq('id', orderId);
    
    if (buildingError) {
      console.error('❌ Database update failed (building):', buildingError);
    } else {
      console.log('✅ Database updated: status=building, chosen_dex=', best.dex, 'execution_price=', executionPrice);
    }

    sendUpdate(orderId, {
      status: 'building',
      chosenDex: best.dex,
      quotes,
      price: executionPrice,
    });

    // Insert order event - USE CORRECT COLUMN NAMES
    const { error: eventError } = await supabase
      .from('order_events')
      .insert({
        order_id: orderId,
        event: 'routing_complete',      // ← Changed from 'event_type'
        metadata: {                      // ← Changed from 'data'
          chosen_dex: best.dex,
          quotes: quotes.map(q => ({
            dex: q.dex,
            amountOut: q.amountOut.toString()
          })),
          execution_price: executionPrice
        }
      });
    
    if (eventError) {
      console.error('❌ Event insert failed (routing):', eventError);
    }

    if (best.dex !== 'raydium') {
      await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId);
      
      sendUpdate(orderId, { status: 'failed', error: 'Only Raydium execution supported' });
      throw new Error('Only Raydium execution supported on devnet');
    }

    if (!rayCtx) {
      await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId);
      
      sendUpdate(orderId, { status: 'failed', error: 'Raydium context not available' });
      throw new Error('Raydium context not available');
    }

    // Execute swap
    console.log('🔁 Executing swap on Raydium...');
    
    let txHash: string;
    try {
      txHash = await withTimeout(
        raydiumExecute(
          rayCtx.poolInfo,
          rayCtx.poolKeys,
          rayCtx.inputAmount,
          rayCtx.outputAmount
        ),
        20_000
      );

      console.log('✅ Transaction submitted:', txHash);

      // Update database: submitted - NO tx_hash COLUMN, store in transactions table
      const { error: submittedError } = await supabase
        .from('orders')
        .update({ status: 'submitted' })
        .eq('id', orderId);
      
      if (submittedError) {
        console.error('❌ Database update failed (submitted):', submittedError);
      } else {
        console.log('✅ Database updated: status=submitted');
      }

      // Insert into transactions table
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          order_id: orderId,
          dex_used: best.dex,
          execution_price: executionPrice,
          tx_hash: txHash
        });
      
      if (txError) {
        console.error('❌ Transaction insert failed:', txError);
      } else {
        console.log('✅ Transaction record created:', txHash);
      }

      sendUpdate(orderId, {
        status: 'submitted',
        txHash,
        dex: 'raydium',
      });

      // Insert order event
      await supabase
        .from('order_events')
        .insert({
          order_id: orderId,
          event: 'transaction_submitted',
          metadata: {
            tx_hash: txHash,
            dex: 'raydium'
          }
        });

    } catch (execError: any) {
      console.error('❌ Execution failed:', execError.message);
      
      await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId);
      
      sendUpdate(orderId, { 
        status: 'failed', 
        error: execError.message 
      });
      
      throw execError;
    }

    // Confirm transaction
   // Confirm transaction
console.log('⏳ Waiting for confirmation...');

let tx;
try {
  // 1) Wait for the transaction to land (transport-level)
  await withTimeout(
    connection.confirmTransaction(txHash, 'confirmed'),
    30_000
  );

  // 2) Fetch full transaction to inspect execution result
  tx = await connection.getTransaction(txHash, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Transaction not found after confirmation');
  }

} catch (e) {
  console.warn('⚠️ confirmTransaction timeout, fetching tx directly');

  tx = await connection.getTransaction(txHash, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error('Transaction not found on-chain');
  }
}

/**
 * 🔴 CRITICAL RULE:
 * - confirmed + meta.err !== null  => FAILED (reverted)
 * - confirmed + meta.err === null  => SUCCESS
 */
if (tx.meta?.err) {
  console.error('❌ Transaction reverted on-chain:', tx.meta.err);

  await supabase
    .from('orders')
    .update({ status: 'failed' })
    .eq('id', orderId);

  await supabase.from('order_events').insert({
    order_id: orderId,
    event: 'execution_failed',
    metadata: {
      tx_hash: txHash,
      error: tx.meta.err,
    },
  });

  sendUpdate(orderId, {
    status: 'failed',
    txHash,
    error: 'Swap reverted on-chain',
  });

  return { txHash };
}

// ✅ SUCCESS PATH (assets actually moved)
await supabase
  .from('orders')
  .update({ status: 'success' })
  .eq('id', orderId);

await supabase.from('order_events').insert({
  order_id: orderId,
  event: 'transaction_success',
  metadata: {
    tx_hash: txHash,
    dex: 'raydium',
  },
});

sendUpdate(orderId, {
  status: 'success',
  txHash,
  dex: 'raydium',
});

console.log('✅ Swap executed successfully');
return { txHash };

  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

console.log('👷 Worker: Initialized and ready');