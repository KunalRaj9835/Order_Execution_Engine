import { describe, it, expect } from 'vitest';

async function route(rayFails: boolean) {
  if (rayFails) return 'meteora';
  return 'raydium';
}

describe('DEX fallback', () => {
  it('falls back when raydium fails', async () => {
    const dex = await route(true);
    expect(dex).toBe('meteora');
  });
});
