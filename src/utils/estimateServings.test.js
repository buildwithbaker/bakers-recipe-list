import { describe, it, expect } from 'vitest';
import { estimateServings } from './estimateServings.js';

const recipe = (over) => ({ name: 'Test', section: 'AMERICAN', ingredients: [], instructions: [], ...over });

describe('estimateServings', () => {
  it('returns null for blank recipes', () => {
    expect(estimateServings(recipe({ is_blank: true }))).toBeNull();
  });

  it('returns null for sections without a meaningful yield', () => {
    expect(estimateServings(recipe({ section: 'SEASONINGS' }))).toBeNull();
    expect(estimateServings(recipe({ section: 'DOUGHS' }))).toBeNull();
  });

  it('prefers an explicit yield parsed from instruction text', () => {
    const r = recipe({ instructions: [{ step: 'Finish', detail: 'Makes 8 cookies.' }] });
    expect(estimateServings(r)).toMatchObject({ servings: 8, basis: 'Estimated from recipe text' });
  });

  it('estimates from primary protein weight', () => {
    const r = recipe({ name: 'Pork Patties', section: 'BREAKFAST', ingredients: [{ type: 'item', text: '1 lb ground pork' }] });
    expect(estimateServings(r)).toMatchObject({ servings: 8, basis: 'Estimated from ingredients' });
  });

  it('estimates a soup from liquid cups', () => {
    const r = recipe({ name: 'Broth Soup', section: 'SOUPS', ingredients: [{ type: 'item', text: '4 cups broth' }] });
    expect(estimateServings(r)).toMatchObject({ servings: 3, basis: 'Estimated from ingredients' });
  });

  it('falls back to the section default', () => {
    const r = recipe({ name: 'Mystery Soup', section: 'SOUPS', ingredients: [{ type: 'item', text: 'salt' }] });
    expect(estimateServings(r)).toMatchObject({ servings: 5, basis: 'Estimated from recipe type' });
  });

  it('returns null when nothing matches and there is no section default', () => {
    expect(estimateServings(recipe({ section: 'NOT A REAL SECTION' }))).toBeNull();
  });
});

// The authored yield wins when it starts with a count (Adam, 2026-10-11). One
// row per real yield shape on main.
describe('estimateServings: the authored yield', () => {
  const withYield = (recipeYield, over = {}) => recipe({ recipeYield, ...over });
  it.each([
    ['4 servings', 4, 'serving', false],
    ['4 servings, 2 drumsticks each', 4, 'serving', false],
    ['8 servings (one 9x13)', 8, 'serving', false],
    ['8 patties', 8, 'patty', false],
    ['about 24 balls', 24, 'ball', true],
    ['1 smoothie (about 16 oz)', 1, 'smoothie', false],
    ['3 sandwiches', 3, 'sandwich', false],
    ['9 squares', 9, 'square', false],
  ])('%j -> %i %s', (y, servings, unit, about) => {
    expect(estimateServings(withYield(y))).toEqual({ servings, basis: 'From the recipe', unit, about, authored: true });
  });

  it('never clamps an authored count', () => {
    expect(estimateServings(withYield('about 24 balls')).servings).toBe(24);
  });

  it('falls back to the estimate for "1 loaf (9x5)": null for DOUGHS', () => {
    expect(estimateServings(withYield('1 loaf (9x5)', { section: 'DOUGHS' }))).toBeNull();
  });

  it('falls back to the estimate for "enough for 1 lb chicken"', () => {
    const r = withYield('enough for 1 lb chicken', { section: 'MARINADES' });
    expect(estimateServings(r)).toEqual(estimateServings({ ...r, recipeYield: undefined }));
    expect(estimateServings(r)).toMatchObject({ servings: 4, basis: 'Estimated from recipe type', unit: 'serving', about: true, authored: false });
  });

  it.each(['about ¾ cup', 'about 1 cup, enough for 4 to 5 racks', 'about 1¼ lb, 12 to 14 lasagna sheets or 4 servings of cut noodles'])(
    'invents no count for %j',
    (y) => {
      expect(estimateServings(withYield(y))?.authored ?? false).toBe(false);
    },
  );
});

