import { describe, it, expect } from 'vitest';
import { ROWS, isWritten } from '../../data/catalog.js';
import { isDraft } from '../../data/sections.js';
import { COOKBOOK_COUNT } from './Masthead.jsx';

// The tagline's "N recipes" is the size of the cookbook: written recipes only,
// with Chef's Drafts left out because they have not been cooked yet.
describe('masthead recipe count', () => {
  it('counts written cookbook recipes, not placeholders and not drafts', () => {
    const drafts = ROWS.filter((r) => isWritten(r) && isDraft(r)).length;
    expect(drafts).toBeGreaterThan(0);
    expect(COOKBOOK_COUNT).toBe(ROWS.filter(isWritten).length - drafts);
    expect(COOKBOOK_COUNT).toBe(ROWS.filter((r) => !r.is_blank && r.section !== 'CHEFS DRAFTS').length);
  });
});
