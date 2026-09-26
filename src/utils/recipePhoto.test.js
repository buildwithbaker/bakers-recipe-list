import { describe, it, expect } from 'vitest';
import { photoInitial, recipePhoto } from './recipePhoto.js';

describe('recipe photo', () => {
  it('has no photo when the recipe names none', () => {
    expect(recipePhoto({ id: 'no-photo-here' })).toBeNull();
  });

  it('resolves an image path under the app base', () => {
    const p = recipePhoto({ id: 'no-photo-here', image: 'photos/lasagna.jpg' });
    expect(p.thumb).toMatch(/\/photos\/lasagna\.jpg$/);
    expect(p.thumb).not.toMatch(/\/\/photos/);
  });

  it('uses the first letter of the name for the empty slot', () => {
    expect(photoInitial('Lasagna')).toBe('L');
    expect(photoInitial('3 Ingredient Cups')).toBe('I');
    expect(photoInitial('')).toBe('·');
  });
});
