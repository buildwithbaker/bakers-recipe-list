import { describe, it, expect } from 'vitest';
import { parseAuthoredYield, yieldLabel } from './authoredYield.js';
import recipes from '../data/recipes.json';

describe('parseAuthoredYield', () => {
  it('reads the count before the first comma or parenthesis', () => {
    expect(parseAuthoredYield('4 servings, 2 drumsticks each')).toEqual({ count: 4, unit: 'serving', about: false });
    expect(parseAuthoredYield('8 servings (one 9x13)')).toEqual({ count: 8, unit: 'serving', about: false });
    expect(parseAuthoredYield('1 smoothie (about 16 oz)')).toEqual({ count: 1, unit: 'smoothie', about: false });
  });

  it('keeps "about" when the author wrote it', () => {
    expect(parseAuthoredYield('about 24 balls')).toEqual({ count: 24, unit: 'ball', about: true });
  });

  it('returns null for yields that are not a count of portions', () => {
    for (const y of ['1 loaf (8½x4½)', 'about ¾ cup', 'enough for 1½ lb chicken', 'about 1 cup, dresses 6-8 cups slaw', undefined, '']) {
      expect(parseAuthoredYield(y), String(y)).toBeNull();
    }
  });

  it('parses every count-led yield on main, and only those', () => {
    const parsed = recipes.filter((r) => !r.is_blank && parseAuthoredYield(r.recipeYield)).map((r) => r.recipeYield);
    for (const y of parsed) expect(y).toMatch(/^(about )?\d+ (servings?|patties|sandwiches|squares|balls|smoothie)/i);
  });
});

describe('yieldLabel', () => {
  it('uses the authored unit, and "About" only when written', () => {
    expect(yieldLabel({ count: 4, unit: 'serving', about: false })).toBe('4 servings');
    expect(yieldLabel({ count: 8, unit: 'patty', about: false })).toBe('8 patties');
    expect(yieldLabel({ count: 24, unit: 'ball', about: true })).toBe('About 24 balls');
    expect(yieldLabel({ count: 1, unit: 'smoothie', about: false })).toBe('1 smoothie');
  });
});
