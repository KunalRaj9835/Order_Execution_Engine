import { sleep } from '../utils/sleep.js';

interface DexQuote {
  dex: string;
  price: number;
  fee: number;
}

export class DexRouter {
  private basePrice = 100; // Base price for mock data

  /**
   * This implementation handles MARKET BUY orders.
   * For market buys: Lower price = better deal (you pay less)
   * 
   * To extend for other order types:
   * - LIMIT ORDER: Add price target check before routing
   * - SNIPER ORDER: Add token launch detection and instant execution
   * - MARKET SELL: Invert the price comparison (higher price = better)
   */

  async getRaydiumQuote(tokenName: string, amount: number): Promise<DexQuote> {
    await sleep(200); // Simulate network delay
    
    // Mock price with variance
    const price = this.basePrice * (0.98 + Math.random() * 0.04);
    
    console.log(`📊 Raydium quote for ${tokenName}: $${price.toFixed(4)}`);
    
    return {
      dex: 'Raydium',
      price: parseFloat(price.toFixed(4)),
      fee: 0.003, // 0.3% fee
    };
  }

  async getMeteoraQuote(tokenName: string, amount: number): Promise<DexQuote> {
    await sleep(200); // Simulate network delay
    
    // Mock price with different variance
    const price = this.basePrice * (0.97 + Math.random() * 0.05);
    
    console.log(`📊 Meteora quote for ${tokenName}: $${price.toFixed(4)}`);
    
    return {
      dex: 'Meteora',
      price: parseFloat(price.toFixed(4)),
      fee: 0.002, // 0.2% fee
    };
  }

  async route(tokenName: string, amount: number) {
    console.log(`🔍 Routing order for ${tokenName} (${amount} tokens)...`);
    
    // Fetch quotes from both DEXs in parallel
    const [raydium, meteora] = await Promise.all([
      this.getRaydiumQuote(tokenName, amount),
      this.getMeteoraQuote(tokenName, amount),
    ]);

    // Calculate effective price after fees
    // For BUYING: price * (1 + fee) - you pay the price PLUS the fee
    const raydiumEffective = raydium.price * (1 + raydium.fee);
    const meteoraEffective = meteora.price * (1 + meteora.fee);

    // Choose the better price (LOWER effective price for buying)
    const bestDex = raydiumEffective <= meteoraEffective ? raydium : meteora;
    const bestEffectivePrice = Math.min(raydiumEffective, meteoraEffective);

    const priceDiff = Math.abs(raydium.price - meteora.price);
    const priceDiffPercent = (priceDiff / Math.min(raydium.price, meteora.price)) * 100;

    console.log(`💰 Best execution: ${bestDex.dex} at ${bestEffectivePrice.toFixed(4)} (after ${(bestDex.fee * 100).toFixed(2)}% fee)`);
    console.log(`📊 Raydium effective: ${raydiumEffective.toFixed(4)} | Meteora effective: ${meteoraEffective.toFixed(4)}`);
    console.log(`📈 Price difference: ${priceDiffPercent.toFixed(2)}% - Savings: ${Math.abs(raydiumEffective - meteoraEffective).toFixed(4)}`);

    return {
      dex: bestDex.dex,
      price: bestDex.price,
      effectivePrice: parseFloat(bestEffectivePrice.toFixed(4)),
      raydiumPrice: raydium.price,
      meteoraPrice: meteora.price,
      priceDifference: parseFloat(priceDiff.toFixed(4)),
      priceDifferencePercent: parseFloat(priceDiffPercent.toFixed(2)),
    };
  }
}