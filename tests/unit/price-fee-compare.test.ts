import { describe, it, expect } from 'vitest';

function effective(price: number, fee: number) {
  return price * (1 - fee);
}

describe('Fee adjusted pricing', () => {
  it('compares net prices correctly', () => {
    const ray = effective(100, 0.003);
    const met = effective(102, 0.002);
    expect(met).toBeGreaterThan(ray);
  });
});
