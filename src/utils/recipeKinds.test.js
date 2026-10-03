import { describe, it, expect } from 'vitest';
import { isComingSoon } from './recipeKinds.js';
import { isModifiedClick } from './isModifiedClick.js';
import { displayRecipes } from '../data/recipeIndex.js';

describe('isComingSoon', () => {
  it('a blank record is a coming-soon placeholder, whatever its source', () => {
    for (const source of ['Original', '', undefined, 'https://example.com/pin/1']) {
      expect(isComingSoon({ is_blank: true, source })).toBe(true);
    }
  });

  it('a real recipe is not, even with a URL source', () => {
    expect(isComingSoon({ is_blank: false, source: 'https://example.com/recipe' })).toBe(false);
  });

  it('agrees with is_blank on every record', () => {
    expect(displayRecipes.filter((r) => isComingSoon(r) !== r.is_blank).map((r) => r.id)).toEqual([]);
  });
});

describe('isModifiedClick', () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it('a plain primary click is not modified', () => {
    expect(isModifiedClick(plain)).toBe(false);
  });

  it('any modifier or a non-primary button is left to the browser', () => {
    expect(isModifiedClick({ ...plain, button: 1 })).toBe(true);
    expect(isModifiedClick({ ...plain, metaKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, shiftKey: true })).toBe(true);
    expect(isModifiedClick({ ...plain, altKey: true })).toBe(true);
  });
});
