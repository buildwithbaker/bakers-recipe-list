import { describe, it, expect } from 'vitest';
import { recipePath, recipeKeyFromPath } from './recipeRoute.js';
import { rawRecipes, recipesById } from '../data/recipeIndex.js';

// The tests pass `base` explicitly: import.meta.env.BASE_URL is '/' under
// vitest and '/bakers-recipe-list/' in the app, and the round trip has to hold
// for whichever one is in force.
const BASE = '/bakers-recipe-list/';

describe('recipePath', () => {
  it('builds a trailing-slash path under the base', () => {
    expect(recipePath('spicy-pork-patties', BASE)).toBe('/bakers-recipe-list/r/spicy-pork-patties/');
  });

  it('swaps the versioned id separator for one a Windows filesystem accepts', () => {
    expect(recipePath('chicken-marinade::v2', BASE)).toBe('/bakers-recipe-list/r/chicken-marinade--v2/');
  });

  it('tolerates a base without its trailing slash', () => {
    expect(recipePath('chili', '/bakers-recipe-list')).toBe('/bakers-recipe-list/r/chili/');
  });
});

describe('recipeKeyFromPath', () => {
  it('reads the recipe back out of its path', () => {
    expect(recipeKeyFromPath('/bakers-recipe-list/r/spicy-pork-patties/', BASE)).toBe('spicy-pork-patties');
  });

  it('restores the versioned id', () => {
    expect(recipeKeyFromPath('/bakers-recipe-list/r/chicken-marinade--v2/', BASE)).toBe('chicken-marinade::v2');
  });

  it('accepts the path without its trailing slash', () => {
    expect(recipeKeyFromPath('/bakers-recipe-list/r/chili', BASE)).toBe('chili');
  });

  it('returns nothing for the list itself', () => {
    expect(recipeKeyFromPath(BASE, BASE)).toBe('');
  });

  it('returns nothing for a path outside the base', () => {
    expect(recipeKeyFromPath('/other/r/chili/', BASE)).toBe('');
  });

  it('returns nothing for a deeper path than one slug', () => {
    expect(recipeKeyFromPath('/bakers-recipe-list/r/chili/extra/', BASE)).toBe('');
  });

  it('does not throw on a malformed escape', () => {
    expect(() => recipeKeyFromPath('/bakers-recipe-list/r/%E0%A4%A/', BASE)).not.toThrow();
  });
});

describe('every recipe survives the round trip', () => {
  it('maps id → path → id for all display rows', () => {
    for (const id of recipesById.keys()) {
      expect(recipeKeyFromPath(recipePath(id, BASE), BASE)).toBe(id);
    }
    expect(recipesById.size).toBeGreaterThan(rawRecipes.length);
  });
});
