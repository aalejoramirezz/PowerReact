import { describe, expect, it } from 'vitest';
import { formatter, formatValue, MISSING } from './formats';

describe('declarative formats', () => {
  it('integer is the default and groups thousands', () => {
    expect(formatValue(10000)).toBe('10,000');
    expect(formatValue(1234.6, { style: 'integer' })).toBe('1,235');
  });

  it('decimal keeps a fixed number of fraction digits', () => {
    expect(formatValue(42.25, { style: 'decimal' })).toBe('42.3');
    expect(formatValue(42, { style: 'decimal', decimals: 2 })).toBe('42.00');
  });

  it('percent takes a fraction', () => {
    expect(formatValue(0.5451, { style: 'percent' })).toBe('54.5%');
    expect(formatValue(0.81, { style: 'percent', decimals: 0 })).toBe('81%');
  });

  it('currency defaults to USD and whole units', () => {
    expect(formatValue(128400, { style: 'currency' })).toBe('$128,400');
    expect(formatValue(9.5, { style: 'currency', currency: 'eur', decimals: 2 })).toBe('€9.50');
  });

  it('compact abbreviates large numbers', () => {
    expect(formatValue(128400, { style: 'compact' })).toBe('128.4K');
    expect(formatValue(3_200_000, { style: 'compact', decimals: 0 })).toBe('3M');
  });

  it('renders missing values as an em dash and clamps decimals', () => {
    expect(formatValue(null)).toBe(MISSING);
    expect(formatValue(Number.NaN)).toBe(MISSING);
    expect(formatValue(1.23456789, { style: 'decimal', decimals: 99 })).toBe('1.234568');
  });

  it('builds reusable formatters', () => {
    const pct = formatter({ style: 'percent', decimals: 0 });
    expect([0.1, 0.25].map(pct)).toEqual(['10%', '25%']);
  });
});
