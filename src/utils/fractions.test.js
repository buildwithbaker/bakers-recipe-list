import { describe, it, expect } from 'vitest';
import { parseQuantityStr, formatQuantity, UNICODE_FRAC } from './fractions.js';

describe('parseQuantityStr', () => {
  it('parses a pure unicode fraction', () => {
    expect(parseQuantityStr('½')).toBe(0.5);
    expect(parseQuantityStr('¼')).toBe(0.25);
    expect(parseQuantityStr('¾')).toBe(0.75);
  });

  it('parses an ASCII fraction', () => {
    expect(parseQuantityStr('3/4')).toBe(0.75);
    expect(parseQuantityStr('1/3')).toBeCloseTo(1 / 3, 10);
  });

  it('parses a digit + unicode fraction with no space ("1½")', () => {
    expect(parseQuantityStr('1½')).toBe(1.5);
    expect(parseQuantityStr('2¼')).toBe(2.25);
  });

  it('parses a mixed number with an ASCII fraction ("1 1/2")', () => {
    expect(parseQuantityStr('1 1/2')).toBe(1.5);
  });

  it('parses integers and decimals', () => {
    expect(parseQuantityStr('2')).toBe(2);
    expect(parseQuantityStr('1.5')).toBe(1.5);
  });

  it('trims surrounding whitespace', () => {
    expect(parseQuantityStr('  ½  ')).toBe(0.5);
  });

  it('returns NaN for empty or unparseable input', () => {
    expect(parseQuantityStr('')).toBeNaN();
    expect(parseQuantityStr('   ')).toBeNaN();
    expect(parseQuantityStr('abc')).toBeNaN();
    expect(parseQuantityStr(null)).toBeNaN();
  });
});

describe('formatQuantity', () => {
  it('round-trips common fractions to unicode glyphs', () => {
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(0.5)).toBe('½');
    expect(formatQuantity(0.75)).toBe('¾');
    expect(formatQuantity(0.375)).toBe('⅜');
    expect(formatQuantity(2 / 3)).toBe('⅔');
  });

  it('formats mixed numbers (whole + fraction)', () => {
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(2.75)).toBe('2¾');
  });

  it('formats whole numbers without a fraction', () => {
    expect(formatQuantity(1)).toBe('1');
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(3)).toBe('3');
  });

  it('snaps to the NEAREST fraction, not the first in range', () => {
    // 0.38 is closer to ⅜ (0.375) than to ⅓ (0.333) — the min-diff search must win.
    expect(formatQuantity(0.38)).toBe('⅜');
  });

  it('returns "0" for non-positive or non-finite input', () => {
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity(-1)).toBe('0');
    expect(formatQuantity(Infinity)).toBe('0');
    expect(formatQuantity(NaN)).toBe('0');
  });
});

describe('UNICODE_FRAC map', () => {
  it('exposes the canonical glyph → decimal values', () => {
    expect(UNICODE_FRAC['½']).toBe(0.5);
    expect(UNICODE_FRAC['⅛']).toBe(0.125);
  });
});
