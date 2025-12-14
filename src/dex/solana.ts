import 'dotenv/config';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

if (!process.env.SOLANA_RPC) {
  throw new Error('SOLANA_RPC missing');
}
if (!process.env.WALLET_PRIVATE_KEY) {
  throw new Error('WALLET_PRIVATE_KEY missing');
}

export const connection = new Connection(
  process.env.SOLANA_RPC,
  'confirmed'
);

export const wallet = Keypair.fromSecretKey(
  bs58.decode(process.env.WALLET_PRIVATE_KEY)
);

export const SOL = LAMPORTS_PER_SOL;
