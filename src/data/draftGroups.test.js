import { describe, it, expect } from 'vitest';
import { CATEGORIES, DRAFT_ROWS, draftCategoryOf, groupDraftsByCategory } from './catalog.js';
import { SECTIONS } from './sections.js';

// The Chef's Drafts page groups drafts by the `category` they will graduate
// to. A draft whose category matches nothing would fall into "Other"; this
// fails CI instead, so a typo is caught before it ships.
describe("Chef's Drafts grouping", () => {
  it('maps every draft category to a real category', () => {
    const bad = DRAFT_ROWS.filter((r) => !draftCategoryOf(r)).map((r) => `${r.id}: ${r.category}`);
    expect(bad).toEqual([]);
  });

  it('draftCategoryOf matches by label', () => {
    expect(draftCategoryOf({ category: 'Italian' })?.id).toBe('italian');
    expect(draftCategoryOf({ category: 'Nope' })).toBeNull();
  });

  it('orders groups by SECTIONS, not file order', () => {
    const groups = groupDraftsByCategory(DRAFT_ROWS);
    const order = SECTIONS.map((s) => s.label);
    const idx = groups.map((g) => order.indexOf(g.category.label));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    // CATEGORIES order is itself SECTIONS order.
    expect(CATEGORIES.map((c) => c.label).filter((l) => order.includes(l))).toEqual(order);
  });

  it('puts a later section first-in-file after an earlier one', () => {
    const rows = [{ id: 'a', category: 'Soups' }, { id: 'b', category: 'American' }];
    expect(groupDraftsByCategory(rows).map((g) => g.category.label)).toEqual(['American', 'Soups']);
  });

  it('counts sum to DRAFT_ROWS.length', () => {
    const total = groupDraftsByCategory(DRAFT_ROWS).reduce((n, g) => n + g.rows.length, 0);
    expect(total).toBe(DRAFT_ROWS.length);
  });

  it('never drops a draft with an unknown category: it goes last under a null category', () => {
    const rows = [{ id: 'x', category: 'Nope' }, { id: 'y', category: 'Soups' }];
    const groups = groupDraftsByCategory(rows);
    expect(groups.map((g) => g.category?.label ?? null)).toEqual(['Soups', null]);
    expect(groups[1].rows).toEqual([rows[0]]);
  });
});
