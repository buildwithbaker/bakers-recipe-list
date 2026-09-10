import { describe, it, expect } from 'vitest';
import { SECTIONS, publicSectionLabel } from './sections.js';
import recipes from './recipes.json';

describe('publicSectionLabel', () => {
  it('gives a real section its label', () => {
    expect(publicSectionLabel('BREAKFAST')).toBe('Breakfast');
    expect(publicSectionLabel('SLOW COOKER')).toBe('Slow Cooker');
  });

  it('gives a staging section NOTHING, rather than a label saying "For Review"', () => {
    for (const section of SECTIONS.filter((s) => s.review)) {
      expect([section.key, publicSectionLabel(section.key)]).toEqual([section.key, null]);
    }
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

describe('the staging leak this exists to stop', () => {
  it('confirms records really do carry "For Review" as a category', () => {
    // If this ever stops being true the guard is still correct, but the reason
    // for it has changed and someone should re-read publicSectionLabel.
    const staged = recipes.filter((r) => r.category === 'For Review');
    expect(staged.length).toBeGreaterThan(0);
  });
});
