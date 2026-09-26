import { describe, it, expect } from 'vitest';
import { SECTIONS } from './sections.js';
import { displayRecipes } from './recipeIndex.js';
import {
  CATEGORIES, CATEGORY_BY_ID, SECTION_CATEGORY, COLLECTIONS, ROWS_BY_COLLECTION,
  CATALOG_COUNTS, categoryOf, collectionOf, groupByCategory, isWritten, listedRows, plannedByCategory,
  COLL_BOOK, COLL_REVIEW, COLL_TRY,
} from './catalog.js';
import { isToTry, isComingSoon } from '../utils/recipeKinds.js';

describe('catalog: sections -> collections and categories', () => {
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

  it('gives every display row exactly one collection and a category', () => {
    const lost = displayRecipes.filter((r) => !categoryOf(r)).map((r) => r.id);
    expect(lost).toEqual([]);
    const total = COLLECTIONS.reduce((n, c) => n + ROWS_BY_COLLECTION[c.key].length, 0);
    expect(total).toBe(displayRecipes.length);
  });

  it('puts review sections in For Review and to-try sections in To Try', () => {
    for (const r of displayRecipes) {
      const s = SECTIONS.find((x) => x.key === r.section);
      const expected = s.review ? COLL_REVIEW : s.toTry ? COLL_TRY : COLL_BOOK;
      expect(collectionOf(r)).toBe(expected);
    }
  });

  it('keeps To Try made of links only', () => {
    expect(ROWS_BY_COLLECTION[COLL_TRY].every(isToTry)).toBe(true);
  });

  it('counts headline numbers off the rows the list renders', () => {
    expect(CATALOG_COUNTS.written).toBe(displayRecipes.filter(isWritten).length);
    expect(CATALOG_COUNTS.toTry).toBe(ROWS_BY_COLLECTION[COLL_TRY].length);
    expect(CATALOG_COUNTS.comingSoon).toBe(displayRecipes.filter(isComingSoon).length);
    expect(CATALOG_COUNTS.written + CATALOG_COUNTS.toTry + CATALOG_COUNTS.comingSoon).toBe(displayRecipes.length);
  });

  it('merges the two For Review soup buckets into one Soups group', () => {
    const groups = groupByCategory(ROWS_BY_COLLECTION[COLL_REVIEW]);
    const soups = groups.filter((g) => g.category?.id === 'soups');
    expect(soups).toHaveLength(1);
    const expected = ROWS_BY_COLLECTION[COLL_REVIEW].filter((r) => /SOUPS/.test(r.section)).length;
    expect(soups[0].rows).toHaveLength(expected);
  });

  it('groups without losing or duplicating a row', () => {
    for (const c of COLLECTIONS) {
      const rows = ROWS_BY_COLLECTION[c.key];
      const grouped = groupByCategory(rows).flatMap((g) => g.rows);
      expect(grouped).toHaveLength(rows.length);
      expect(new Set(grouped.map((r) => r.id)).size).toBe(rows.length);
    }
  });

  it('uses unique category ids', () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
  });

  it('lists no placeholder and counts every one as planned', () => {
    for (const c of COLLECTIONS) {
      const listed = listedRows(c.key);
      expect(listed.some(isComingSoon)).toBe(false);
      const planned = [...plannedByCategory(c.key).values()].reduce((a, b) => a + b, 0);
      expect(listed.length + planned).toBe(ROWS_BY_COLLECTION[c.key].length);
    }
    expect(listedRows(COLL_TRY)).toHaveLength(CATALOG_COUNTS.toTry);
  });
});
