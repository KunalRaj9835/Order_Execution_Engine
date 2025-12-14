import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { connection, wallet } from './solana.js';
  import { TxVersion } from '@raydium-io/raydium-sdk-v2';
export async function raydiumQuote(
  poolId: string,
  amountSol: number
) {
  const raydium = await Raydium.load({
    owner: wallet,
    connection,
    cluster: 'devnet',
  });

  const { poolInfo, poolKeys } = await raydium.cpmm.getPoolInfoFromRpc(poolId);

  const inputAmount = new BN(amountSol * LAMPORTS_PER_SOL);

  // Manual AMM math
  const reserveA = new BN(Math.floor(poolInfo.mintAmountA * 1e9));
  const reserveB = new BN(Math.floor(poolInfo.mintAmountB * 1e6));

  const inputWithFee = inputAmount.mul(new BN(997000)).div(new BN(1000000));
  const outputAmount = reserveB.mul(inputWithFee).div(reserveA.add(inputWithFee));

  return {
    dex: 'raydium' as const,
    amountOut: BigInt(outputAmount.toString()),
    poolInfo,
    poolKeys, // ← Include poolKeys
    inputAmount,
    outputAmount,
  };
}

export async function raydiumExecute(
  poolInfo: any,
  poolKeys: any, // ← Add poolKeys parameter
  inputAmount: BN,
  outputAmount: BN
) {
  const raydium = await Raydium.load({
    owner: wallet,
    connection,
    cluster: 'devnet',
  });

  const slippage = Number(process.env.SLIPPAGE_BPS || 300) / 10_000; // Default 3%

  console.log('Building Raydium swap transaction...');
  


const { execute } = await raydium.cpmm.swap({
  poolInfo,
  poolKeys,
  baseIn: true,
  fixedOut: false,
  inputAmount,
  swapResult: {
    inputAmount,
    outputAmount,
  },
  slippage,
  txVersion: TxVersion.V0, // ✅ correct
  computeBudgetConfig: {
    units: 600_000,
    microLamports: 200_000,
  },
});


  console.log('Executing Raydium swap...');
  
  // Send transaction without waiting for confirmation
  const { txId } = await execute({ 
    sendAndConfirm: false,
  });
  
  console.log('Raydium transaction sent:', txId);
  
  return txId;
}