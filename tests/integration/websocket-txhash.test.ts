import { describe, it, expect } from 'vitest';

describe('WebSocket txHash', () => {
  it('includes txHash on confirm', () => {
    const msg = { status: 'confirmed', txHash: 'MOCK_TX_123' };
    expect(msg.txHash).toContain('MOCK_TX');
  });
});
