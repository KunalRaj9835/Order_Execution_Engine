import { AmmImpl } from '@meteora-ag/dynamic-amm-sdk';
import { PublicKey } from '@solana/web3.js';
import { connection } from './solana.js';

export async function meteoraQuote(
  poolId: string,
  amountLamports: number
) {
  const amm = await AmmImpl.create(
    connection as any,                
    new PublicKey(poolId)             
  );

  const quote = amm.getSwapQuote(
    amm.tokenAMint.address,           
    amountLamports,
    Number(process.env.SLIPPAGE_BPS) / 10_000
  );

  return {
    dex: 'meteora' as const,
    amountOut: BigInt(quote.swapOutAmount.toString()),
  };
}
