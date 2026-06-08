import { describe, it, expect } from 'vitest';
import { parseIngredient } from './parseIngredient.js';

describe('parseIngredient', () => {
  it('parses "quantity unit name"', () => {
    expect(parseIngredient('1 lb ground pork')).toEqual({ quantity: 1, unit: 'lb', name: 'ground pork' });
  });

  it('parses a leading unicode fraction', () => {
    expect(parseIngredient('¼ cup breadcrumbs')).toEqual({ quantity: 0.25, unit: 'cup', name: 'breadcrumbs' });
  });

  it('sums a mixed number "2 ½"', () => {
    expect(parseIngredient('2 ½ tsp paprika')).toEqual({ quantity: 2.5, unit: 'tsp', name: 'paprika' });
  });

  it('defaults a count item to the "each" unit', () => {
    expect(parseIngredient('1 egg')).toEqual({ quantity: 1, unit: 'each', name: 'egg' });
  });

  it('normalizes unit aliases (cups → cup, tablespoon → tbsp)', () => {
    expect(parseIngredient('2 cups flour')?.unit).toBe('cup');
    expect(parseIngredient('1 tablespoon olive oil')?.unit).toBe('tbsp');
  });

  it('extracts a trailing parenthetical quantity', () => {
    expect(parseIngredient('Olive oil (1/4 cup)')).toEqual({ quantity: 0.25, unit: 'cup', name: 'olive oil' });
  });

  it('uses the lower bound of a range quantity', () => {
    expect(parseIngredient('8-16 oz tomato sauce')).toEqual({ quantity: 8, unit: 'oz', name: 'tomato sauce' });
  });

  it('strips qualifier words from the name', () => {
    expect(parseIngredient('1 cup finely chopped onion')?.name).toBe('onion');
  });

  it('returns null for non-food / to-taste lines', () => {
    expect(parseIngredient('Salt and pepper to taste')).toBeNull();
    expect(parseIngredient('Water')).toBeNull();
  });

  it('returns null for empty or non-string input', () => {
    expect(parseIngredient('')).toBeNull();
    expect(parseIngredient('   ')).toBeNull();
    expect(parseIngredient(null)).toBeNull();
    expect(parseIngredient(42)).toBeNull();
  });

  it('returns null when there is no leading quantity', () => {
    expect(parseIngredient('ground pork')).toBeNull();
  });
});
