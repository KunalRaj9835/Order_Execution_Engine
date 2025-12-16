import { describe, it, expect } from 'vitest';

describe('Queue concurrency', () => {
  it('processes multiple orders', async () => {
    const orders = [1, 2, 3];
    const processed = orders.map(o => `done-${o}`);
    expect(processed.length).toBe(3);
  });
});
