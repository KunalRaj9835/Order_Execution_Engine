import { supabase, Order, Transaction, OrderEvent } from './supabase.js';

export class OrderService {
  
  async createOrder(orderId: string, tokenName: string, amount: number) {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        token_name: tokenName,
        amount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }

    await this.logEvent(orderId, 'pending', { message: 'Order created and queued' });
    return data;
  }

  
  async updateOrderPrices(
    orderId: string,
    raydiumPrice: number,
    meteoraPrice: number,
    chosenDex: string
  ) {
    const { error } = await supabase
      .from('orders')
      .update({
        raydium_price: raydiumPrice,
        meteora_price: meteoraPrice,
        chosen_dex: chosenDex,
        status: 'routing',
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order prices:', error);
      throw error;
    }

    await this.logEvent(orderId, 'routing', {
      raydium_price: raydiumPrice,
      meteora_price: meteoraPrice,
      chosen_dex: chosenDex,
      price_difference: Math.abs(raydiumPrice - meteoraPrice),
    });
  }

 
  async updateOrderStatus(orderId: string, status: string, metadata?: Record<string, any>) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      throw error;
    }

    await this.logEvent(orderId, status, metadata);
  }

  
  async createTransaction(
    orderId: string,
    dexUsed: string,
    executionPrice: number,
    txHash: string
  ) {
    
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        order_id: orderId,
        dex_used: dexUsed,
        execution_price: executionPrice,
        tx_hash: txHash,
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
      throw txError;
    }

    
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        execution_price: executionPrice,
        status: 'confirmed',
      })
      .eq('id', orderId);

    if (orderError) {
      console.error('Error updating order with execution price:', orderError);
      throw orderError;
    }

    await this.logEvent(orderId, 'confirmed', {
      tx_hash: txHash,
      execution_price: executionPrice,
      dex_used: dexUsed,
    });
  }

  
  async markOrderFailed(orderId: string, errorMessage: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'failed' })
      .eq('id', orderId);

    if (error) {
      console.error('Error marking order as failed:', error);
      throw error;
    }

    await this.logEvent(orderId, 'failed', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }

  
  async logEvent(orderId: string, event: string, metadata?: Record<string, any>) {
    const { error } = await supabase
      .from('order_events')
      .insert({
        order_id: orderId,
        event,
        metadata: metadata || {},
      });

    if (error) {
      console.error('Error logging event:', error);
    }
  }

  
  async getOrder(orderId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
      throw error;
    }

    return data;
  }

 
  async getOrderEvents(orderId: string) {
    const { data, error } = await supabase
      .from('order_events')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching order events:', error);
      throw error;
    }

    return data;
  }

  
  async getOrderTransactions(orderId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', orderId);

    if (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }

    return data;
  }
}

export const orderService = new OrderService();