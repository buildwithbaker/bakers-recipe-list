import { describe, it, expect } from 'vitest';
import { NEW_TAG, centralToday, daysSinceAdded, getAutoTags, getEffectiveTags, isNew, setClock } from './autoTags.js';
import { rawRecipes } from '../data/recipeIndex.js';
import cookbookBaseline from '../data/cookbookBaseline.json';
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

describe('auto-tags: #new for 14 days after added', () => {
  // 2026-10-26 17:00 UTC is 12:00 CDT on 2026-10-26 in Central.
  const NOON = new Date('2026-10-26T17:00:00Z');
  const daysBefore = (n) => {
    const d = new Date(Date.UTC(2026, 9, 26 - n));
    return d.toISOString().slice(0, 10);
  };
  const live = (added) => rec({ added });

  it('reads today as the Central calendar date', () => {
    expect(centralToday(NOON)).toBe('2026-10-26');
    // 03:30 UTC on the 27th is still 22:30 on the 26th in Central.
    expect(centralToday(new Date('2026-10-27T03:30:00Z'))).toBe('2026-10-26');
  });

  it('is new on the day it goes live (day 0)', () => {
    expect(daysSinceAdded(live(daysBefore(0)), NOON)).toBe(0);
    expect(getAutoTags(live(daysBefore(0)), { now: NOON })).toContain(NEW_TAG);
  });

  it('is new on day 13', () => {
    expect(daysSinceAdded(live(daysBefore(13)), NOON)).toBe(13);
    expect(isNew(live(daysBefore(13)), NOON)).toBe(true);
  });

  it('is not new on day 14', () => {
    expect(daysSinceAdded(live(daysBefore(14)), NOON)).toBe(14);
    expect(isNew(live(daysBefore(14)), NOON)).toBe(false);
    expect(getAutoTags(live(daysBefore(14)), { now: NOON })).not.toContain(NEW_TAG);
  });

  it('is never new with a future added date', () => {
    expect(isNew(live('2026-10-27'), NOON)).toBe(false);
    expect(isNew(live('2027-01-01'), NOON)).toBe(false);
  });

  // 03:30 UTC on 2026-10-27 is the 27th in UTC but the 26th in Central. Judged
  // in UTC, added 10-13 would be day 14 (not new) and added 10-27 day 0 (new);
  // judged in Central they are day 13 (new) and day -1 (future, not new).
  it('judges the day in Central when UTC is already tomorrow', () => {
    const lateEvening = new Date('2026-10-27T03:30:00Z');
    expect(isNew(live('2026-10-13'), lateEvening)).toBe(true);
    expect(isNew(live('2026-10-27'), lateEvening)).toBe(false);
  });

  it('counts calendar days across the fall DST change', () => {
    // Added in CDT, judged in CST (2026-11-01 ends DST): 13 days, still new.
    const cst = new Date('2026-11-10T18:00:00Z');
    expect(daysSinceAdded(live('2026-10-28'), cst)).toBe(13);
    expect(isNew(live('2026-10-29'), cst)).toBe(true);
    expect(isNew(live('2026-10-27'), cst)).toBe(false);
  });

  it('gives nothing without a valid added, and nothing to a blank', () => {
    expect(isNew(rec({}), NOON)).toBe(false);
    expect(isNew(live('not-a-date'), NOON)).toBe(false);
    expect(isNew(rec({ added: daysBefore(0), is_blank: true }), NOON)).toBe(false);
  });

  it('reads the injectable clock when no now is passed', () => {
    try {
      setClock(NOON);
      expect(getEffectiveTags(live('2026-10-20'))).toContain(NEW_TAG);
      setClock(new Date('2026-12-01T17:00:00Z'));
      expect(getEffectiveTags(live('2026-10-20'))).not.toContain(NEW_TAG);
      setClock(() => NOON);
      expect(isNew(live('2026-10-20'))).toBe(true);
    } finally {
      setClock();
    }
  });

  // The frozen baseline went live before `added` existed: none of it is ever
  // new. On 0007dbe that is every written Cookbook record, so nothing shows NEW.
  it('never shows NEW on a baseline record', () => {
    const baseline = new Set(cookbookBaseline.ids);
    const onBaseline = rawRecipes.filter((r) => baseline.has(r.id));
    expect(onBaseline.length).toBeGreaterThan(0);
    for (const r of onBaseline) {
      expect(r.added, r.id).toBeUndefined();
      expect(getEffectiveTags(r), r.id).not.toContain(NEW_TAG);
      expect(getEffectiveTags(r, { now: NOON }), r.id).not.toContain(NEW_TAG);
    }
  });
});
