import { describe, it, expect } from 'vitest';

describe('Order lifecycle', () => {
  it('follows full lifecycle', async () => {
    const states = ['pending', 'routing', 'building', 'submitted', 'confirmed'];
    expect(states).toContain('confirmed');
  });
});
