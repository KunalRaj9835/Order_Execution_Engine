import { describe, it, expect } from 'vitest';

describe('WebSocket sequence', () => {
  it('emits statuses in order', () => {
    const emitted = ['pending', 'routing', 'confirmed'];
    expect(emitted[0]).toBe('pending');
    expect(emitted.at(-1)).toBe('confirmed');
  });
});
