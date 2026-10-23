import { describe, expect, it } from 'vitest';
import { formatClock, plural } from './format';

describe('formatClock', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(125)).toBe('02:05');
    expect(formatClock(3000)).toBe('50:00');
  });
  it('never goes negative', () => {
    expect(formatClock(-4)).toBe('00:00');
  });
});

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(0, 'card')).toBe('0 cards');
  });
});
