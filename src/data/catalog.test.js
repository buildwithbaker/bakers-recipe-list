import { describe, it, expect } from 'vitest';
import { SECTIONS, isDraft } from './sections.js';
import { cookbookRecipes, displayRecipes } from './recipeIndex.js';
import {
  CATEGORIES, CATEGORY_BY_ID, SECTION_CATEGORY, ROWS, LISTED_ROWS, DRAFT_ROWS, PLANNED_BY_CATEGORY,
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

  it('gives every display row a category, and lists every cookbook row once', () => {
    const lost = displayRecipes.filter((r) => !categoryOf(r)).map((r) => r.id);
    expect(lost).toEqual([]);
    expect(ROWS).toHaveLength(cookbookRecipes.length);
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(cookbookRecipes.length);
  });

  it('orders rows by section, in SECTIONS order', () => {
    const order = new Map(SECTIONS.map((s, i) => [s.key, i]));
    const seen = ROWS.map((r) => order.get(r.section));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('counts headline numbers off the rows the list renders', () => {
    expect(CATALOG_COUNTS.written).toBe(cookbookRecipes.filter(isWritten).length);
    expect(CATALOG_COUNTS.comingSoon).toBe(cookbookRecipes.filter(isComingSoon).length);
    expect(CATALOG_COUNTS.written + CATALOG_COUNTS.comingSoon).toBe(cookbookRecipes.length);
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

describe("catalog: Chef's Drafts stay out of the Cookbook", () => {
  const drafts = displayRecipes.filter(isDraft);

  it('has at least one draft to test against', () => {
    expect(drafts.length).toBeGreaterThan(0);
  });

  it('keeps every draft out of ROWS, LISTED_ROWS and the related-recipes pool', () => {
    expect(ROWS.filter(isDraft)).toEqual([]);
    expect(LISTED_ROWS.filter(isDraft)).toEqual([]);
    expect(cookbookRecipes.filter(isDraft)).toEqual([]);
    expect(groupByCategory(LISTED_ROWS).map((g) => g.category.id)).not.toContain('chefs-drafts');
  });

  it('puts every written draft, and nothing else, in DRAFT_ROWS', () => {
    expect(DRAFT_ROWS.every(isDraft)).toBe(true);
    expect(DRAFT_ROWS.map((r) => r.id)).toEqual(drafts.filter(isWritten).map((r) => r.id));
  });

  it('accounts for every display row: Cookbook plus drafts', () => {
    expect(ROWS.length + drafts.length).toBe(displayRecipes.length);
  });
});
