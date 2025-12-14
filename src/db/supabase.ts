import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);


export interface Order {
  id: string;
  token_name: string;
  amount: number;
  raydium_price?: number;
  meteora_price?: number;
  chosen_dex?: string;
  execution_price?: number;
  status: string;
  created_at?: string;
}

export interface Transaction {
  id?: string;
  order_id: string;
  dex_used: string;
  execution_price: number;
  tx_hash: string;
  created_at?: string;
}

export interface OrderEvent {
  id?: string;
  order_id: string;
  event: string;
  metadata?: Record<string, any>;
  created_at?: string;
}