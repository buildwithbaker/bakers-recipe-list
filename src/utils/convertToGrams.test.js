import { describe, it, expect } from 'vitest';
import { convertToGrams } from './convertToGrams.js';

describe('convertToGrams', () => {
  it('converts base mass/volume units', () => {
    expect(convertToGrams({ quantity: 2, unit: 'g', name: 'salt' })).toBe(2);
    expect(convertToGrams({ quantity: 1, unit: 'kg', name: 'flour' })).toBe(1000);
    expect(convertToGrams({ quantity: 1, unit: 'lb', name: 'pork' })).toBe(453.6);
    expect(convertToGrams({ quantity: 1, unit: 'tbsp', name: 'oil' })).toBe(15);
  });

  it('defaults 1 cup to 240g for un-overridden (liquid) names', () => {
    expect(convertToGrams({ quantity: 1, unit: 'cup', name: 'water' })).toBe(240);
  });

  it('applies a cup override for solids', () => {
    expect(convertToGrams({ quantity: 1, unit: 'cup', name: 'all-purpose flour' })).toBe(125);
    expect(convertToGrams({ quantity: 2, unit: 'cup', name: 'diced onion' })).toBe(320);
  });

  it('matches the LONGEST cup-override needle, not the first', () => {
    // 'sweet potato' (133) must beat the shorter 'potato' (150).
    expect(convertToGrams({ quantity: 1, unit: 'cup', name: 'diced sweet potato' })).toBe(133);
    expect(convertToGrams({ quantity: 1, unit: 'cup', name: 'diced potato' })).toBe(150);
    // 'cooked rice' (158) must beat 'rice' (185) regardless of table order.
    expect(convertToGrams({ quantity: 1, unit: 'cup', name: 'cooked rice' })).toBe(158);
    expect(convertToGrams({ quantity: 1, unit: 'cup', name: 'white rice' })).toBe(185);
  });

  it('matches the LONGEST each-override needle', () => {
    expect(convertToGrams({ quantity: 2, unit: 'each', name: 'chicken breast' })).toBe(300);
    expect(convertToGrams({ quantity: 1, unit: 'each', name: 'whole chicken' })).toBe(1500);
    expect(convertToGrams({ quantity: 1, unit: 'each', name: 'asian pear' })).toBe(200);
  });

  it('returns null for "each" with no per-piece weight', () => {
    expect(convertToGrams({ quantity: 1, unit: 'each', name: 'mystery widget' })).toBeNull();
  });

  it('returns null for unknown units and non-positive quantities', () => {
    expect(convertToGrams({ quantity: 1, unit: 'furlong', name: 'flour' })).toBeNull();
    expect(convertToGrams({ quantity: 0, unit: 'cup', name: 'flour' })).toBeNull();
    expect(convertToGrams({ quantity: -1, unit: 'g', name: 'flour' })).toBeNull();
  });
});
