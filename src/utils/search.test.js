import { describe, it, expect } from 'vitest';
import { DRAFT_ROWS, ROWS } from '../data/catalog.js';
import { displayRecipes } from '../data/recipeIndex.js';
import { isDraft } from '../data/sections.js';
import { isComingSoon } from './recipeKinds.js';
import {
  SEARCH_MODES, ingredientLineMatches, matchRecipe, normaliseText, recipeMatchesQuery, searchCatalog, searchMatches,
} from './search.js';

const { ALL, NAME, INGREDIENT } = SEARCH_MODES;
// What SearchResults searches: the Cookbook, then Chef's Drafts.
const SEARCHED = [...ROWS, ...DRAFT_ROWS];
const names = (rows) => rows.map((r) => r.name);
const lines = (...texts) => texts.map((text) => ({ type: 'item', text }));

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
    expect(recipeMatchesQuery(row({ tags: ['#holiday'] }), 'holiday')).toBe(true);
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

describe('search: Chef\'s Drafts', () => {
  it('finds drafts when they are searched alongside the Cookbook, after it', () => {
    expect(DRAFT_ROWS.length).toBeGreaterThan(0);
    const d = DRAFT_ROWS[0];
    const res = searchCatalog(SEARCHED, d.name, NAME);
    expect(res.some((r) => r.id === d.id)).toBe(true);
    // Every draft hit sits after every Cookbook hit.
    const all = searchCatalog(SEARCHED, 'onion', ALL);
    const firstDraft = all.findIndex(isDraft);
    expect(firstDraft).toBeGreaterThan(-1);
    expect(all.slice(firstDraft).every(isDraft)).toBe(true);
  });
});

describe('search: modes', () => {
  const RED_ONION = [
    'Persian Chicken',
    'Sheet Pan Chicken Shawarma Thighs',
    'California Burgers with Special Sauce',
    'Quick Pickled Red Onions',
  ];

  it('"red onion" finds the 4 recipes that use it, 2 of them drafts, in Ingredient and All mode', () => {
    for (const mode of [INGREDIENT, ALL]) {
      const res = searchCatalog(SEARCHED, 'red onion', mode);
      expect(names(res).sort()).toEqual([...RED_ONION].sort());
      expect(res.filter(isDraft)).toHaveLength(2);
    }
  });

  it('Name mode ignores ingredients, tags, source and category', () => {
    const r = { name: 'Plain Rice', section: 'SIDES', source: 'Grandma', tags: ['#holiday'], ingredients: lines('1 cup rice') };
    expect(recipeMatchesQuery(r, 'plain', NAME)).toBe(true);
    for (const q of ['cup rice', 'holiday', 'grandma', 'sides']) expect(recipeMatchesQuery(r, q, NAME)).toBe(false);
    expect(names(searchCatalog(SEARCHED, 'red onion', NAME))).toEqual(['Quick Pickled Red Onions']);
  });

  it('Ingredient mode reads item lines only, never the name, tags or a header', () => {
    const r = {
      name: 'Onion Soup', section: 'SOUPS', source: 'Original', tags: ['#onion'],
      ingredients: [{ type: 'header', text: 'For the onion topping:' }, ...lines('1 cup broth')],
    };
    expect(recipeMatchesQuery(r, 'onion', INGREDIENT)).toBe(false);
  });

  it('Ingredient mode matches whole words, not inside other words', () => {
    expect(ingredientLineMatches('1 cup rice', 'ice')).toBe(false);
    expect(ingredientLineMatches('2 scallions, sliced', 'scallion')).toBe(true);
    expect(ingredientLineMatches('1 tsp ground ginger', 'gin')).toBe(false);
  });

  it('Ingredient mode is plural-tolerant both ways', () => {
    expect(ingredientLineMatches('2 medium tomatoes, sliced', 'tomato')).toBe(true);
    expect(ingredientLineMatches('2 Tbsp tomato paste', 'tomatoes')).toBe(true);
    expect(ingredientLineMatches('Berries, for topping', 'berry')).toBe(true);
    expect(ingredientLineMatches('1 cup berry jam', 'berries')).toBe(true);
    expect(ingredientLineMatches('1 large red onion', 'Red Onions')).toBe(true);
    expect(names(searchCatalog(SEARCHED, 'berry', INGREDIENT))).toContain('Chocolate Peanut Butter Chia Pudding');
    expect(names(searchCatalog(SEARCHED, 'tomato', INGREDIENT))).toContain('Lasagna');
  });

  it('Ingredient mode matches several words as a phrase, in order', () => {
    expect(ingredientLineMatches('1 small red onion, sliced thin', 'red onion')).toBe(true);
    expect(ingredientLineMatches('1 onion, red if you have it', 'red onion')).toBe(false);
    expect(ingredientLineMatches('1 red bell pepper and 1 onion', 'red onion')).toBe(false);
  });

  it('"onion" in Ingredient mode skips onion powder and onion salt', () => {
    expect(ingredientLineMatches('1 tsp onion powder', 'onion')).toBe(false);
    expect(ingredientLineMatches('½ tsp onion salt', 'onion')).toBe(false);
    expect(ingredientLineMatches('1 tsp onion powder', 'onion powder')).toBe(true);
    expect(ingredientLineMatches('½ tsp onion salt', 'onion salt')).toBe(true);
    // Only straight after the match: "salt" later on the line is a different ingredient.
    expect(ingredientLineMatches('1 onion, salt to taste', 'onion')).toBe(true);
    // A recipe that has onion only as onion powder or onion salt drops out.
    const onionRes = names(searchCatalog(SEARCHED, 'onion', INGREDIENT));
    const powderRes = names(searchCatalog(SEARCHED, 'onion powder', INGREDIENT));
    for (const name of ['Spicy Pork Patties', 'Rib Rub', 'Classic Coleslaw Dressing']) {
      expect(onionRes).not.toContain(name);
      expect(powderRes).toContain(name);
      expect(names(searchCatalog(SEARCHED, 'onion', ALL))).toContain(name);
    }
  });

  it('"garlic" in Ingredient mode skips garlic powder but finds "4 cloves garlic"', () => {
    expect(ingredientLineMatches('1 tsp garlic powder', 'garlic')).toBe(false);
    expect(ingredientLineMatches('1 tsp garlic salt', 'garlic')).toBe(false);
    expect(ingredientLineMatches('4 cloves garlic', 'garlic')).toBe(true);
    expect(ingredientLineMatches('4 garlic cloves, minced', 'garlic')).toBe(true);
    const both = { name: 'X', section: 'SIDES', source: 'Original', tags: [], ingredients: lines('1 tsp garlic powder', '4 cloves garlic') };
    expect(matchRecipe(both, 'garlic', INGREDIENT)).toEqual({ field: 'ingredient', matchedLine: '4 cloves garlic' });
    const powderOnly = { ...both, ingredients: lines('1 tsp garlic powder') };
    expect(matchRecipe(powderOnly, 'garlic', INGREDIENT)).toBeNull();
    expect(matchRecipe(powderOnly, 'garlic powder', INGREDIENT)).toEqual({ field: 'ingredient', matchedLine: '1 tsp garlic powder' });
    const res = names(searchCatalog(SEARCHED, 'garlic', INGREDIENT));
    expect(res).not.toContain('Rib Rub');
    expect(names(searchCatalog(SEARCHED, 'garlic powder', INGREDIENT))).toContain('Rib Rub');
  });

  it('defaults to All, today\'s behaviour', () => {
    const r = { name: 'Plain Rice', section: 'SIDES', source: 'Original', tags: [], ingredients: lines('1 tsp onion powder') };
    expect(recipeMatchesQuery(r, 'onion')).toBe(true);
    expect(searchCatalog(SEARCHED, 'chicken')).toEqual(searchCatalog(SEARCHED, 'chicken', ALL));
  });
});

describe('search: matchedLine', () => {
  const r = {
    name: 'Plain Rice', section: 'SIDES', source: 'Grandma', tags: ['#holiday'],
    ingredients: [{ type: 'header', text: 'For the rice:' }, ...lines('1 cup rice', '2 cups water')],
  };

  it('a name hit has none', () => {
    expect(matchRecipe(r, 'plain', ALL)).toEqual({ field: 'name' });
    expect(matchRecipe(r, 'plain', NAME)).toEqual({ field: 'name' });
    expect(matchRecipe(r, 'plain', ALL).matchedLine).toBeUndefined();
  });

  it('an ingredient hit gives the first matching line', () => {
    expect(matchRecipe(r, 'water', ALL)).toEqual({ field: 'ingredient', matchedLine: '2 cups water' });
    expect(matchRecipe(r, 'cup', INGREDIENT)).toEqual({ field: 'ingredient', matchedLine: '1 cup rice' });
  });

  it('a tag, source or category hit says which', () => {
    expect(matchRecipe(r, 'holiday', ALL)).toEqual({ field: 'tag', matchedLine: 'tag #holiday' });
    expect(matchRecipe(r, 'grandma', ALL)).toEqual({ field: 'source', matchedLine: 'source: Grandma' });
    expect(matchRecipe(r, 'sides', ALL)).toEqual({ field: 'category', matchedLine: 'category: Sides' });
  });

  it('no match is null', () => {
    expect(matchRecipe(r, 'lasagna', ALL)).toBeNull();
    expect(matchRecipe(r, 'holiday', INGREDIENT)).toBeNull();
  });

  it('searchMatches carries the line with each real result', () => {
    const hits = searchMatches(SEARCHED, 'red onion', INGREDIENT);
    const persian = hits.find((h) => h.recipe.name === 'Persian Chicken');
    expect(persian.matchedLine).toBe('1 red onion, chopped');
    expect(searchMatches(SEARCHED, '  ', INGREDIENT)).toEqual([]);
  });
});
