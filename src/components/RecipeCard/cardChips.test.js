import { describe, it, expect } from 'vitest';
import { MAX_CHIPS, cardChips, chipLabel } from './cardChips.js';
import { CONTROLLED_TAGS, FACET, facetOf } from '../../data/tagFacets.js';
import { PROTEIN_TAGS } from '../../utils/autoTags.js';

describe('card chips', () => {
  it('orders Method > Plan > Diet > Protein, whatever order the tags came in', () => {
    expect(cardChips(['#chicken', '#vegetarian', '#make-ahead', '#one-pan'])).toEqual(['#one-pan', '#make-ahead', '#vegetarian']);
    expect(cardChips(['#pork', '#high-protein'])).toEqual(['#high-protein', '#pork']);
  });

  it(`shows at most ${MAX_CHIPS}`, () => {
    expect(cardChips(['#one-pan', '#oven', '#make-ahead', '#holiday', '#beef'])).toEqual(['#one-pan', '#oven', '#make-ahead']);
  });

  it('keeps the incoming order within a facet', () => {
    expect(cardChips(['#oven', '#one-pan'])).toEqual(['#oven', '#one-pan']);
  });

  it('never shows cuisine, dish type, dish form, sub-cuisine, a collection, #spicy or #new', () => {
    const never = ['#asian', '#snack', '#side-dish', '#marinade', '#salad', '#dip', '#korean', '#bbq', '#peanut-butter', '#spicy', '#new'];
    expect(cardChips(never)).toEqual([]);
    expect(cardChips([...never, '#beef'])).toEqual(['#beef']);
  });

  it('never shows an off-list tag', () => {
    expect(cardChips(['#greek-yogurt', '#rotisserie', '#eggs', '#crispy', '#chicken'])).toEqual(['#chicken']);
  });

  it('never repeats the card\'s category label', () => {
    expect(cardChips(['#slow-cooker', '#pork'], 'Slow Cooker')).toEqual(['#pork']);
    expect(cardChips(['#slow-cooker', '#pork'], "Chef's Drafts")).toEqual(['#slow-cooker', '#pork']);
  });

  it('drops duplicates and survives no tags', () => {
    expect(cardChips(['#oven', '#oven'])).toEqual(['#oven']);
    expect(cardChips(undefined)).toEqual([]);
  });

  it('writes a tag as a short label', () => {
    expect(chipLabel('#one-pan')).toBe('One pan');
    expect(chipLabel('#high-protein')).toBe('High protein');
    expect(chipLabel('#chicken')).toBe('Chicken');
  });
});

describe('tag facets', () => {
  it('lists the approved tags plus #peanut-butter, without #weeknight or the dropped collections', () => {
    expect(CONTROLLED_TAGS).toHaveLength(29);
    expect(CONTROLLED_TAGS).toContain('#peanut-butter');
    for (const dropped of ['#weeknight', '#greek-yogurt', '#rotisserie', '#eggs']) expect(CONTROLLED_TAGS).not.toContain(dropped);
  });

  it('spells every listed tag the way the schema allows', () => {
    for (const t of CONTROLLED_TAGS) expect(t).toMatch(/^#[a-z0-9-]+$/);
  });

  it('gives every auto protein tag the protein facet, without a manual copy', () => {
    expect(PROTEIN_TAGS.length).toBeGreaterThan(0);
    for (const t of PROTEIN_TAGS) {
      expect(facetOf(t)).toBe(FACET.PROTEIN);
      expect(CONTROLLED_TAGS).not.toContain(t);
    }
  });
});
