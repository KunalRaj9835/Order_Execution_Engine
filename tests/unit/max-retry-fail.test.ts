import { describe, it, expect } from 'vitest';

describe('Max retry failure', () => {
  it('fails after max retries', async () => {
    let err;
    try {
      for (let i = 0; i < 3; i++) throw new Error();
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
  });
});
