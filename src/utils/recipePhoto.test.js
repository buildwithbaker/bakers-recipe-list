import { describe, it, expect } from 'vitest';
import { photoInitial, recipePhoto } from './recipePhoto.js';

describe('recipe photo', () => {
  it('has no photo when the recipe names none', () => {
    expect(recipePhoto({ id: 'x' })).toBeNull();
  });

  it('resolves an image path under the app base', () => {
    const p = recipePhoto({ image: 'images/recipes/lasagna.jpg' });
    expect(p.thumb).toMatch(/\/images\/recipes\/lasagna\.jpg$/);
    expect(p.thumb).not.toMatch(/\/\/images/);
  });

  it('uses the first letter of the name for the empty slot', () => {
    expect(photoInitial('Lasagna')).toBe('L');
    expect(photoInitial('3 Ingredient Cups')).toBe('I');
    expect(photoInitial('')).toBe('·');
  });
});
