import { describe, it, expect } from 'vitest';
import { getAutoTags, getEffectiveTags } from './autoTags.js';
import { rawRecipes } from '../data/recipeIndex.js';
import { isDraft, publicSectionLabel } from '../data/sections.js';

// A written record with one plain ingredient, so only the category tag can fire.
const rec = (fields) => ({
  section: 'AMERICAN',
  category: 'American',
  tags: [],
  is_blank: false,
  ingredients: [{ type: 'item', text: '1 cup water' }],
  instructions: [{ step: 'Boil', detail: 'Boil the water.' }],
  ...fields,
});

describe('auto-tags: cuisine and dish type come from category', () => {
  it('tags a Chef\'s Draft from its destination category', () => {
    expect(getAutoTags(rec({ section: 'CHEFS DRAFTS', category: 'Asian' }))).toEqual(['#asian']);
    expect(getAutoTags(rec({ section: 'CHEFS DRAFTS', category: 'Sides' }))).toEqual(['#side-dish']);
  });

  it('follows category, not section, when the two disagree', () => {
    const tags = getAutoTags(rec({ section: 'AMERICAN', category: 'Mexican' }));
    expect(tags).toContain('#mexican');
    expect(tags).not.toContain('#american');
  });

  it('gives no category tag for a category with no entry', () => {
    expect(getAutoTags(rec({ section: 'DESSERTS', category: 'Desserts' }))).toEqual([]);
  });

  it('still gives a blank nothing', () => {
    expect(getAutoTags(rec({ section: 'CHEFS DRAFTS', category: 'Asian', is_blank: true }))).toEqual([]);
  });

  it('still drops a tag the record already carries by hand', () => {
    const r = rec({ section: 'CHEFS DRAFTS', category: 'Snacks', tags: ['#snack'] });
    expect(getAutoTags(r)).toEqual([]);
    expect(getEffectiveTags(r)).toEqual(['#snack']);
  });

  // The section is no longer read at all: swapping it changes nothing.
  it('ignores section for every record in the file', () => {
    for (const r of rawRecipes) {
      expect(getAutoTags({ ...r, section: 'NOT A SECTION' }), r.id).toEqual(getAutoTags(r));
    }
  });

  // Where a Cookbook record's category is its section's label (every record on
  // 0007dbe), keying on category gives exactly what keying on section gave.
  it('gives a Cookbook record the tag its section gave', () => {
    const agreeing = rawRecipes.filter((r) => !isDraft(r) && !r.is_blank && r.category === publicSectionLabel(r.section));
    expect(agreeing.length).toBeGreaterThan(0);
    const sectionTag = { American: '#american', Asian: '#asian', Snacks: '#snack', Marinades: '#marinade' };
    for (const r of agreeing) {
      const want = sectionTag[r.category];
      if (want) expect(getEffectiveTags(r), r.id).toContain(want);
    }
  });

  it('gives every written draft its category tag', () => {
    const drafts = rawRecipes.filter((r) => isDraft(r) && !r.is_blank && r.category === 'Asian');
    expect(drafts.length).toBeGreaterThan(0);
    for (const r of drafts) expect(getEffectiveTags(r), r.id).toContain('#asian');
  });
});
