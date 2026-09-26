import { describe, it, expect } from 'vitest';
import { displayRecipes } from '../data/recipeIndex.js';
import { COLL_BOOK, COLL_REVIEW, COLL_TRY } from '../data/catalog.js';
import { isComingSoon } from './recipeKinds.js';
import { normaliseText, recipeMatchesQuery, searchCatalog } from './search.js';

const row = (over) => ({
  id: 'x', name: 'Plain Rice', section: 'SIDES', source: 'Original', tags: [], is_blank: false,
  ingredients: [{ type: 'item', text: '1 cup rice' }], instructions: [], ...over,
});

describe('search', () => {
  it('ignores case and accents', () => {
    expect(normaliseText('Jalapeño')).toBe('jalapeno');
    expect(recipeMatchesQuery(row({ ingredients: [{ type: 'item', text: '2 jalapeños' }] }), 'JALAPENO')).toBe(true);
  });

  it('matches name, ingredient, tag, source and category label', () => {
    expect(recipeMatchesQuery(row(), 'plain')).toBe(true);
    expect(recipeMatchesQuery(row(), 'cup rice')).toBe(true);
    expect(recipeMatchesQuery(row({ tags: ['#weeknight'] }), 'weeknight')).toBe(true);
    expect(recipeMatchesQuery(row({ source: 'Grandma' }), 'grandma')).toBe(true);
    expect(recipeMatchesQuery(row(), 'sides')).toBe(true);
    expect(recipeMatchesQuery(row(), 'lasagna')).toBe(false);
  });

  it('returns nothing for a blank query', () => {
    expect(searchCatalog(displayRecipes, '   ').total).toBe(0);
  });

  it('searches every collection at once: "chicken" hits all three', () => {
    const res = searchCatalog(displayRecipes, 'chicken');
    expect(res[COLL_BOOK].length).toBeGreaterThan(0);
    expect(res[COLL_REVIEW].length).toBeGreaterThan(0);
    expect(res[COLL_TRY].length).toBeGreaterThan(0);
    expect(res.total).toBe(res[COLL_BOOK].length + res[COLL_REVIEW].length + res[COLL_TRY].length);
  });

  it('never returns a coming-soon placeholder', () => {
    const planned = displayRecipes.find(isComingSoon);
    const res = searchCatalog(displayRecipes, planned.name);
    const all = [...res[COLL_BOOK], ...res[COLL_REVIEW], ...res[COLL_TRY]];
    expect(all.some(isComingSoon)).toBe(false);
  });
});
