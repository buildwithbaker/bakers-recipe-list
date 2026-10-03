import { describe, it, expect } from 'vitest';
import { SECTIONS } from './sections.js';
import { displayRecipes } from './recipeIndex.js';
import {
  CATEGORIES, CATEGORY_BY_ID, SECTION_CATEGORY, ROWS, LISTED_ROWS, PLANNED_BY_CATEGORY,
  CATALOG_COUNTS, categoryOf, groupByCategory, isWritten,
} from './catalog.js';
import { isComingSoon } from '../utils/recipeKinds.js';

describe('catalog: sections -> categories', () => {
  it('maps every declared section to a real category', () => {
    // Fails the moment a section is added to sections.js without a category,
    // so a new bucket cannot silently disappear from the list.
    const unmapped = SECTIONS.filter((s) => !CATEGORY_BY_ID.has(SECTION_CATEGORY[s.key])).map((s) => s.key);
    expect(unmapped).toEqual([]);
  });

  it('maps nothing that is not a declared section', () => {
    const keys = new Set(SECTIONS.map((s) => s.key));
    expect(Object.keys(SECTION_CATEGORY).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('declares no category that no section uses', () => {
    const used = new Set(Object.values(SECTION_CATEGORY));
    expect(CATEGORIES.map((c) => c.id).filter((id) => !used.has(id))).toEqual([]);
  });

  it('gives every display row a category, and lists every row once', () => {
    const lost = displayRecipes.filter((r) => !categoryOf(r)).map((r) => r.id);
    expect(lost).toEqual([]);
    expect(ROWS).toHaveLength(displayRecipes.length);
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(displayRecipes.length);
  });

  it('orders rows by section, in SECTIONS order', () => {
    const order = new Map(SECTIONS.map((s, i) => [s.key, i]));
    const seen = ROWS.map((r) => order.get(r.section));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('counts headline numbers off the rows the list renders', () => {
    expect(CATALOG_COUNTS.written).toBe(displayRecipes.filter(isWritten).length);
    expect(CATALOG_COUNTS.comingSoon).toBe(displayRecipes.filter(isComingSoon).length);
    expect(CATALOG_COUNTS.written + CATALOG_COUNTS.comingSoon).toBe(displayRecipes.length);
  });

  it('groups without losing or duplicating a row', () => {
    const grouped = groupByCategory(ROWS).flatMap((g) => g.rows);
    expect(grouped).toHaveLength(ROWS.length);
    expect(new Set(grouped.map((r) => r.id)).size).toBe(ROWS.length);
  });

  it('uses unique category ids', () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
  });

  it('lists no placeholder and counts every one as planned', () => {
    expect(LISTED_ROWS.some(isComingSoon)).toBe(false);
    const planned = [...PLANNED_BY_CATEGORY.values()].reduce((a, b) => a + b, 0);
    expect(LISTED_ROWS.length + planned).toBe(ROWS.length);
    expect(planned).toBe(CATALOG_COUNTS.comingSoon);
  });
});
