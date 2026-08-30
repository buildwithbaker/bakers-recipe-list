import { describe, it, expect } from 'vitest';
import { SECTIONS } from './sections.js';
import { displayedBySection } from './recipeIndex.js';
import {
  navSections,
  navSectionsByTab,
  tabForSection,
  displayRowCount,
  TAB_ORDER,
  TAB_RECIPES,
  TAB_REVIEW,
  TAB_TOTRY,
} from './navSections.js';

// The sections drawer is a second enumeration of the section list, and
// RecipeList renders only the sections owned by the active tab. When the drawer
// rendered SECTIONS.map() directly, the two disagreed: every entry outside the
// active tab pointed at an element that was not in the DOM, and the click did
// nothing — getElementById returned null and handleLinkClick bailed. Same shape
// as the marinade bug. These tests are that invariant.

describe('sections drawer model', () => {
  it('gives every drawer entry an owning tab and at least one display row', () => {
    const broken = navSections
      .filter((s) => !TAB_ORDER.includes(s.tab) || s.count === 0)
      .map((s) => `${s.label} [tab=${s.tab} rows=${s.count}]`);
    expect(broken).toEqual([]);
  });

  it('reports a row count matching the rendered display list', () => {
    const wrong = navSections
      .filter((s) => s.count !== (displayedBySection.get(s.key) ?? []).length)
      .map((s) => s.label);
    expect(wrong).toEqual([]);
  });

  it('lists no section that renders zero rows', () => {
    // DESSERTS is declared in sections.js but has no records, so it must not
    // appear. Dropped by the zero-row filter, not by a name special-case.
    expect(SECTIONS.some((s) => s.key === 'DESSERTS')).toBe(true);
    expect(displayRowCount('DESSERTS')).toBe(0);
    expect(navSections.map((s) => s.key)).not.toContain('DESSERTS');
  });

  it('routes each section to the tab that actually renders it', () => {
    for (const section of navSections) {
      const expected = section.review ? TAB_REVIEW : section.toTry ? TAB_TOTRY : TAB_RECIPES;
      expect(section.tab).toBe(expected);
    }
  });

  it('never routes a drawer entry to the tag-driven Peanut tab', () => {
    // The Peanut Butter tab is built from PEANUT_GROUPS (a tag filter), not from
    // sections, so no section can own it.
    expect(TAB_ORDER).not.toContain('peanut');
    expect(navSections.map((s) => s.tab)).not.toContain('peanut');
  });

  it('groups every entry exactly once, preserving section order within a group', () => {
    const grouped = navSectionsByTab.flatMap((g) => g.sections);
    // Same set, no duplicates, nothing dropped. The flat order differs from
    // navSections because groups are emitted in TAB_ORDER, not declaration order.
    expect(grouped).toHaveLength(navSections.length);
    expect(new Set(grouped.map((s) => s.key)).size).toBe(navSections.length);
    expect([...grouped.map((s) => s.key)].sort()).toEqual([...navSections.map((s) => s.key)].sort());
    // Within a group, sections.js declaration order is preserved.
    for (const group of navSectionsByTab) {
      const declared = navSections.filter((s) => s.tab === group.tab).map((s) => s.key);
      expect(group.sections.map((s) => s.key)).toEqual(declared);
    }
    expect(navSectionsByTab.every((g) => g.sections.length > 0)).toBe(true);
  });

  // Non-vacuity. The old drawer rendered SECTIONS.map() with no tab routing, so
  // from the default Recipes tab an entry only resolved if its section was both
  // non-empty AND owned by that tab. Everything else was a silent no-op. If this
  // count ever reaches 0 the tests above have stopped proving anything.
  it('is not vacuous: the old SECTIONS.map drawer left dead entries', () => {
    const deadFromRecipesTab = SECTIONS.filter(
      (s) => displayRowCount(s.key) === 0 || tabForSection(s) !== TAB_RECIPES,
    );
    expect(SECTIONS).toHaveLength(37);
    expect(deadFromRecipesTab).toHaveLength(21);
    expect(navSections.filter((s) => s.tab === TAB_RECIPES)).toHaveLength(16);
  });
});
