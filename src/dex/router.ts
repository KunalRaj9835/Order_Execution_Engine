export type Dex = 'raydium' | 'meteora';

export interface DexQuote {
  dex: Dex;
  amountOut: bigint;
}

export function chooseBest(quotes: DexQuote[]): DexQuote {
  if (quotes.length === 0) {
    throw new Error('No valid DEX quotes');
  }

  return quotes.reduce((best, q) =>
    q.amountOut > best.amountOut ? q : best
  );
}
