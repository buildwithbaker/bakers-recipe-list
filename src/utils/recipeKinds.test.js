import { describe, it, expect } from 'vitest';
import { isToTry, isComingSoon } from './recipeKinds.js';
import { isModifiedClick } from './isModifiedClick.js';
import { displayRecipes } from '../data/recipeIndex.js';
import { SECTIONS } from '../data/sections.js';

const toTryKeys = new Set(SECTIONS.filter((s) => s.toTry).map((s) => s.key));

describe('isToTry / isComingSoon', () => {
  it('a blank with a URL source is a To Try entry, not a coming-soon placeholder', () => {
    const r = { is_blank: true, source: 'https://example.com/pin/1' };
    expect(isToTry(r)).toBe(true);
    expect(isComingSoon(r)).toBe(false);
  });

  it('a blank without a URL is a coming-soon placeholder', () => {
    for (const source of ['Original', '', undefined, 'www.example.com']) {
      const r = { is_blank: true, source };
      expect(isComingSoon(r)).toBe(true);
      expect(isToTry(r)).toBe(false);
    }
  });

  it('a real recipe is neither, even with a URL source', () => {
    const r = { is_blank: false, source: 'https://example.com/recipe' };
    expect(isToTry(r)).toBe(false);
    expect(isComingSoon(r)).toBe(false);
  });

  // The To Try tab is built from the TO TRY sections. If a record there were a
  // coming-soon placeholder, the placeholder filter would empty part of it again.
  it('no record in a To Try section is a coming-soon placeholder', () => {
    const offenders = displayRecipes.filter((r) => toTryKeys.has(r.section) && isComingSoon(r));
    expect(offenders.map((r) => r.name)).toEqual([]);
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
