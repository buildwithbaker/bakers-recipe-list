import { describe, it, expect } from 'vitest';
import { displayRecipes } from '../data/recipeIndex.js';
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
    expect(searchCatalog(displayRecipes, '   ')).toEqual([]);
  });

  it('returns every written row that matches, in the order given', () => {
    const res = searchCatalog(displayRecipes, 'chicken');
    expect(res.length).toBeGreaterThan(0);
    const expected = displayRecipes.filter((r) => !isComingSoon(r) && recipeMatchesQuery(r, 'chicken'));
    expect(res.map((r) => r.id)).toEqual(expected.map((r) => r.id));
  });

  it('never returns a coming-soon placeholder', () => {
    const planned = displayRecipes.find(isComingSoon);
    expect(planned).toBeTruthy();
    const res = searchCatalog(displayRecipes, planned.name);
    expect(res.some(isComingSoon)).toBe(false);
  });

  // The To Try and For Review collections were removed on 2026-10-02: a
  // recipe that only lived there finds nothing.
  it('finds nothing for a removed To Try or For Review recipe', () => {
    expect(searchCatalog(displayRecipes, 'Cajun Dirty Rice')).toEqual([]);
  });
});
