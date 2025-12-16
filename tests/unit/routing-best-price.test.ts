import { describe, it, expect } from 'vitest';

function chooseBest(ray: number, met: number) {
  return ray > met ? 'raydium' : 'meteora';
}

describe('DEX routing', () => {
  it('chooses meteora when price is better', () => {
    const dex = chooseBest(98, 102);
    expect(dex).toBe('meteora');
  });
});
