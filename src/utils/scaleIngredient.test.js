import { describe, it, expect } from 'vitest';
import { scaleIngredientText } from './scaleIngredient.js';

describe('scaleIngredientText', () => {
  it('returns the text unchanged at scale 1', () => {
    expect(scaleIngredientText('1 egg', 1)).toBe('1 egg');
  });

  it('scales the leading quantity up', () => {
    expect(scaleIngredientText('1 lb ground pork', 2)).toBe('2 lb ground pork');
  });

  it('scales the leading quantity down', () => {
    expect(scaleIngredientText('2 cup flour', 0.5)).toBe('1 cup flour');
  });

  it('formats scaled fractions with unicode glyphs', () => {
    // 1 cup × 0.5 → ½ cup
    expect(scaleIngredientText('1 cup sugar', 0.5)).toBe('½ cup sugar');
  });

  it('leaves unparseable lines untouched', () => {
    expect(scaleIngredientText('Salt and pepper to taste', 2)).toBe('Salt and pepper to taste');
  });
});
