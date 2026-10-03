import { describe, it, expect } from 'vitest';
import { SECTIONS, publicSectionLabel } from './sections.js';
import recipes from './recipes.json';
import idManifest from './recipes.ids.json';
import { resolveRecipe } from './recipeIndex.js';

describe('publicSectionLabel', () => {
  it('gives a real section its label', () => {
    expect(publicSectionLabel('BREAKFAST')).toBe('Breakfast');
    expect(publicSectionLabel('SLOW COOKER')).toBe('Slow Cooker');
  });

  it('returns null for an unknown key instead of throwing', () => {
    expect(publicSectionLabel('NOT A SECTION')).toBe(null);
    expect(publicSectionLabel(undefined)).toBe(null);
  });

  // The whole point: no label this function hands out may leak workflow state.
  it('never returns a label containing a staging word', () => {
    const leaks = SECTIONS
      .map((s) => publicSectionLabel(s.key))
      .filter((label) => label && /for\s*review|to\s*try/i.test(label));
    expect(leaks).toEqual([]);
  });
});

// The To Try and For Review collections were removed on 2026-10-02. Nothing
// may file a record under them again, and no record still claims them.
describe('Cookbook only', () => {
  it('declares no To Try or For Review section', () => {
    expect(SECTIONS.map((s) => s.key).filter((k) => /^(TO TRY|FOR REVIEW)/.test(k))).toEqual([]);
    expect(SECTIONS.filter((s) => 'review' in s || 'toTry' in s).map((s) => s.key)).toEqual([]);
  });

  it('has no record with a To Try or For Review section or category', () => {
    const left = recipes.filter((r) => /^(TO TRY|FOR REVIEW)/.test(r.section) || /^(To Try|For Review)$/.test(r.category));
    expect(left.map((r) => r.id)).toEqual([]);
  });

  // Old links into the removed collections: the two dirty-rice placeholders
  // land on Dirty Rice; everything else resolves to nothing (the list).
  it('lands the retired dirty-rice placeholders on Dirty Rice', () => {
    for (const key of ['cajun-dirty-rice', 'one-pot-chicken-dirty-rice']) {
      expect(resolveRecipe(key)?.id).toBe('dirty-rice');
      expect(resolveRecipe(idManifest.ids[key])?.id).toBe('dirty-rice');
    }
  });

  it('resolves a removed For Review recipe, its version keys and its old name to nothing', () => {
    expect(idManifest.removed['lemon-herb-chicken-marinade']).toMatchObject({ to: null, versions: 2 });
    for (const key of ['lemon-herb-chicken-marinade', 'lemon-herb-chicken-marinade::v1', 'lemon-herb-chicken-marinade::v2', 'Lemon Herb - Chicken Marinade']) {
      expect([key, resolveRecipe(key)]).toEqual([key, null]);
    }
  });
});
