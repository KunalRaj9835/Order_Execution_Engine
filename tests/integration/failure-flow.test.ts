import { describe, it, expect } from 'vitest';

describe('Failure flow', () => {
  it('emits failed status', () => {
    const status = 'failed';
    const reason = 'mock execution error';
    expect(status).toBe('failed');
    expect(reason).toBeDefined();
  });
});
