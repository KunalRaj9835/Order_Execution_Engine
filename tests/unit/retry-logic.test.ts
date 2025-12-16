import { describe, it, expect } from 'vitest';

async function retry(fn: () => Promise<void>, max = 3) {
  let count = 0;
  while (count < max) {
    try {
      await fn();
      return true;
    } catch {
      count++;
    }
  }
  throw new Error('failed');
}

describe('Retry logic', () => {
  it('retries and succeeds on 3rd attempt', async () => {
    let tries = 0;
    const result = await retry(async () => {
      tries++;
      if (tries < 3) throw new Error();
    });
    expect(result).toBe(true);
  });
});
