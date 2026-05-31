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
    expect(estimateServings(r)).toEqual({ servings: 8, basis: 'Estimated from recipe text' });
  });

  it('estimates from primary protein weight', () => {
    const r = recipe({ name: 'Pork Patties', section: 'BREAKFAST', ingredients: [{ type: 'item', text: '1 lb ground pork' }] });
    expect(estimateServings(r)).toEqual({ servings: 8, basis: 'Estimated from ingredients' });
  });

  it('estimates a soup from liquid cups', () => {
    const r = recipe({ name: 'Broth Soup', section: 'SOUPS', ingredients: [{ type: 'item', text: '4 cups broth' }] });
    expect(estimateServings(r)).toEqual({ servings: 3, basis: 'Estimated from ingredients' });
  });

  it('falls back to the section default', () => {
    const r = recipe({ name: 'Mystery Soup', section: 'SOUPS', ingredients: [{ type: 'item', text: 'salt' }] });
    expect(estimateServings(r)).toEqual({ servings: 5, basis: 'Estimated from recipe type' });
  });

  it('returns null when nothing matches and there is no section default', () => {
    expect(estimateServings(recipe({ section: 'NOT A REAL SECTION' }))).toBeNull();
  });
});
