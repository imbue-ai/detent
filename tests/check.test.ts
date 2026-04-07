import { describe, it, expect } from 'vitest';
import { check } from '../src/check.js';

describe('check', () => {
  it('returns true for any request', () => {
    const request = new Request('https://example.com');
    expect(check(request)).toBe(true);
  });

  it('returns true even with a config path', () => {
    const request = new Request('https://example.com', { method: 'POST' });
    expect(check(request, '/some/path')).toBe(true);
  });
});
