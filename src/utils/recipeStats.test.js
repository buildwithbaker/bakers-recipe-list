import { describe, it, expect } from 'vitest';
import { ingredientCount, stepCount } from './recipeStats.js';

describe('recipe stats', () => {
  it('counts only item ingredients', () => {
    const r = { ingredients: [{ type: 'header', text: 'Sauce' }, { type: 'item', text: 'a' }, { type: 'section', text: 'v1' }, { type: 'item', text: 'b' }] };
    expect(ingredientCount(r)).toBe(2);
  });

  it('counts classic and grouped steps, skipping markers', () => {
    const r = { instructions: [
      { step: 'Brown', detail: 'Brown the beef' },
      { type: 'section', step: 'Version 1', detail: '' },
      { type: 'item', step: 'Mix everything', detail: '' },
      { type: 'header', step: 'To serve', detail: '' },
    ] };
    expect(stepCount(r)).toBe(2);
  });

  it('treats a missing array as zero', () => {
    expect(ingredientCount({})).toBe(0);
    expect(stepCount(null)).toBe(0);
  });
});
