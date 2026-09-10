import { describe, it, expect } from 'vitest';
import { relatedRecipes, RELATED_LIMIT, MIN_SHARED_TAGS, DISTINCTIVE_TAG_MAX_SHARE } from './relatedRecipes.js';
import { displayRecipes } from '../data/recipeIndex.js';

// Sections are per-row by default, because the ranking now EXCLUDES a
// candidate in the recipe's own section — a shared fixture section would
// silently empty every result. Tests that care about the section rule pass one
// explicitly. The section names are also deliberately absent from
// SECTION_TAG_MAP, and the ingredient triggers no protein or spicy rule, so
// getEffectiveTags returns exactly the tags the fixture declares.
const row = (id, tags, extra = {}) => ({
  id,
  name: id,
  section: `SECTION-${id}`,
  category: 'Breakfast',
  source: 'Original',
  tags,
  ingredients: [{ type: 'item', text: '1 egg' }],
  instructions: [{ step: 'Cook', detail: 'Cook it.' }],
  is_blank: false,
  ...extra,
});

// The distinctive-tag rule is a SHARE of the published set, so a fixture has to
// be big enough for the share to mean anything: with 24 published rows the
// cutoff is 6, so a tag on 2-5 rows is distinctive and a tag on 6+ is not.
// These filler rows carry `tag` to push its frequency up, and never match the
// recipe under test.
const PAD = 20;
const filler = (n, tag, prefix = 'f') =>
  Array.from({ length: n }, (_, i) => row(`${prefix}-${tag}-${i}`, [tag]));
const pad = () => filler(PAD, '#padding');

describe('relatedRecipes — the match floor', () => {
  it(`requires at least ${MIN_SHARED_TAGS} shared tags`, () => {
    const me = row('me', ['#rareA', '#rareB']);
    const all = [me, row('one-tag', ['#rareA']), row('two-tags', ['#rareA', '#rareB']), ...pad()];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['two-tags']);
  });

  it('requires at least one shared tag to be distinctive, not two bucket labels', () => {
    // #bulkA and #bulkB are each on well over the cutoff, so sharing both is
    // sharing two drawer labels and nothing more.
    const me = row('me', ['#bulkA', '#bulkB', '#rare']);
    const all = [
      me,
      row('two-bulk', ['#bulkA', '#bulkB']),
      row('bulk-plus-rare', ['#bulkA', '#rare']),
      ...filler(10, '#bulkA', 'a'),
      ...filler(10, '#bulkB', 'b'),
      ...pad(),
    ];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['bulk-plus-rare']);
  });

  it('derives the distinctive cutoff from the catalog size, not a fixed count', () => {
    // Same tag frequency (6), different catalog sizes: distinctive in the big
    // one, a bucket label in the small one.
    const me = row('me', ['#mid', '#rare']);
    const match = row('match', ['#mid', '#rare']);
    const midRows = filler(4, '#mid', 'm'); // #mid ends up on 6 rows total
    const small = [me, match, ...midRows, ...filler(10, '#padding')]; // 16 published → cutoff 4
    const big = [me, match, ...midRows, ...filler(80, '#padding')]; // 86 published → cutoff 21.5
    expect(DISTINCTIVE_TAG_MAX_SHARE).toBe(0.25);
    // #rare is on 2 of 16 = distinctive either way, so both match; what changes
    // is whether #mid alone would have been enough. Check that directly:
    const meMidOnly = row('me2', ['#mid', '#mid2']);
    const matchMidOnly = row('match2', ['#mid', '#mid2']);
    const mid2Rows = filler(4, '#mid2', 'n');
    const smallMid = [meMidOnly, matchMidOnly, ...midRows, ...mid2Rows, ...filler(6, '#padding')];
    const bigMid = [meMidOnly, matchMidOnly, ...midRows, ...mid2Rows, ...filler(80, '#padding')];
    expect(relatedRecipes(meMidOnly, smallMid)).toEqual([]); // 22 published, cutoff 5.5, #mid on 6 → not distinctive
    expect(relatedRecipes(meMidOnly, bigMid).map((r) => r.id)).toEqual(['match2']); // cutoff 24 → distinctive
    expect(relatedRecipes(me, small).map((r) => r.id)).toEqual(['match']);
    expect(relatedRecipes(me, big).map((r) => r.id)).toEqual(['match']);
  });

  it('renders nothing rather than padding when nothing clears the floor', () => {
    const me = row('me', ['#a']);
    expect(relatedRecipes(me, [me, row('x', ['#a']), ...pad()])).toEqual([]);
  });
});

describe('relatedRecipes — cross-section only', () => {
  it('excludes a candidate from the recipe\'s own section', () => {
    const me = row('me', ['#rareA', '#rareB'], { section: 'SHARED' });
    const neighbour = row('neighbour', ['#rareA', '#rareB'], { section: 'SHARED' });
    const elsewhere = row('elsewhere', ['#rareA', '#rareB']);
    expect(relatedRecipes(me, [me, neighbour, elsewhere, ...pad()]).map((r) => r.id))
      .toEqual(['elsewhere']);
  });

  it('keeps a sibling version even though it shares the section', () => {
    const me = row('parent::v1', ['#rareA', '#rareB'], { section: 'SHARED' });
    const sibling = row('parent::v2', ['#rareA', '#rareB'], { section: 'SHARED' });
    const neighbour = row('neighbour', ['#rareA', '#rareB'], { section: 'SHARED' });
    expect(relatedRecipes(me, [me, sibling, neighbour, ...pad()]).map((r) => r.id))
      .toEqual(['parent::v2']);
  });

  it('keeps a sibling that shares NOTHING — it is related by construction', () => {
    const me = row('parent::v1', ['#rareA', '#rareB'], { section: 'SHARED' });
    const sibling = row('parent::v2', ['#nothing-in-common'], { section: 'SHARED' });
    expect(relatedRecipes(me, [me, sibling, ...pad()]).map((r) => r.id)).toEqual(['parent::v2']);
  });

  it('keeps a sibling whose only shared tags are bucket labels the floor would drop', () => {
    const me = row('parent::v1', ['#bulkA', '#bulkB'], { section: 'SHARED' });
    const sibling = row('parent::v2', ['#bulkA', '#bulkB'], { section: 'SHARED' });
    const stranger = row('stranger', ['#bulkA', '#bulkB']);
    const all = [me, sibling, stranger, ...filler(10, '#bulkA', 'a'), ...filler(10, '#bulkB', 'b'), ...pad()];
    // The stranger shares exactly the same two bucket labels and is dropped;
    // the sibling is not subject to that judgement at all.
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['parent::v2']);
  });

  it('puts siblings ahead of a stronger inferred match, in version order', () => {
    const me = row('parent::v2', ['#rareA', '#rareB', '#rareC'], { section: 'SHARED' });
    const v1 = row('parent::v1', ['#rareA'], { section: 'SHARED' });
    const v3 = row('parent::v3', ['#rareA'], { section: 'SHARED' });
    const best = row('best-inferred', ['#rareA', '#rareB', '#rareC']);
    // v1 and v3 share one tag each; `best-inferred` shares all three. Siblings
    // still lead, and among themselves they stay in file (version) order.
    expect(relatedRecipes(me, [v1, me, v3, best, ...pad()]).map((r) => r.id))
      .toEqual(['parent::v1', 'parent::v3', 'best-inferred']);
  });

  it('still drops a BLANK sibling — the one rule siblings do not escape', () => {
    const me = row('parent::v1', ['#rareA', '#rareB'], { section: 'SHARED' });
    const blankSibling = row('parent::v2', ['#rareA', '#rareB'],
      { section: 'SHARED', is_blank: true, ingredients: [], instructions: [] });
    expect(relatedRecipes(me, [me, blankSibling, ...pad()])).toEqual([]);
  });

  it('does not treat two unrelated versioned rows as siblings', () => {
    const me = row('alpha::v1', ['#rareA', '#rareB'], { section: 'SHARED' });
    const other = row('beta::v1', ['#rareA', '#rareB'], { section: 'SHARED' });
    expect(relatedRecipes(me, [me, other, ...pad()])).toEqual([]);
  });
});

describe('relatedRecipes — rarity weighting', () => {
  it('prefers a rarer shared pair over a more common one', () => {
    const me = row('me', ['#common', '#alsoCommon', '#rareA', '#rareB']);
    const all = [
      me,
      row('common-pair', ['#common', '#alsoCommon', '#rareA']),
      row('rare-pair', ['#rareA', '#rareB']),
      ...filler(12, '#common', 'c'),
      ...filler(12, '#alsoCommon', 'd'),
      ...pad(),
    ];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['rare-pair', 'common-pair']);
  });

  it('does not let blank records shape the weights', () => {
    const me = row('me', ['#rareA', '#rareB']);
    const blanks = Array.from({ length: 20 }, (_, i) =>
      row(`blank-${i}`, ['#rareA', '#rareB'], { is_blank: true, ingredients: [], instructions: [] }));
    const all = [me, row('match', ['#rareA', '#rareB']), ...blanks, ...pad()];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['match']);
  });
});

describe('relatedRecipes — ordering and exclusions', () => {
  it('breaks a tie on score with the same category', () => {
    const me = row('me', ['#rareA', '#rareB']);
    const all = [
      me,
      row('other-category', ['#rareA', '#rareB'], { category: 'Dinner' }),
      row('same-category', ['#rareA', '#rareB']),
      ...pad(),
    ];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['same-category', 'other-category']);
  });

  it('breaks a full tie on file order, so the ordering is deterministic', () => {
    const me = row('me', ['#rareA', '#rareB']);
    const all = [me, row('first', ['#rareA', '#rareB']), row('second', ['#rareA', '#rareB']),
      row('third', ['#rareA', '#rareB']), ...pad()];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['first', 'second', 'third']);
  });

  it('gives an identical shared-tag set an identical score, whatever order the tags are in', () => {
    const me = row('me', ['#p', '#q', '#r']);
    const all = [me, row('forwards', ['#p', '#q', '#r']), row('backwards', ['#r', '#q', '#p']), ...pad()];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['forwards', 'backwards']);
  });

  it('excludes the recipe itself', () => {
    const me = row('me', ['#rareA', '#rareB']);
    expect(relatedRecipes(me, [me, ...pad()])).toEqual([]);
  });

  it('excludes blank placeholders — a coming-soon link is a dead end', () => {
    const me = row('me', ['#rareA', '#rareB']);
    const blank = row('blank', ['#rareA', '#rareB'], { is_blank: true, ingredients: [], instructions: [] });
    expect(relatedRecipes(me, [me, blank, ...pad()])).toEqual([]);
  });

  it('returns nothing when the recipe itself has no tags', () => {
    expect(relatedRecipes(row('me', []), [row('me', []), row('x', ['#a', '#b']), ...pad()])).toEqual([]);
  });

  it(`caps the list at ${RELATED_LIMIT}`, () => {
    const me = row('me', ['#rareA', '#rareB']);
    // Padding sized so the 21 rows carrying #rareA stay under the distinctive
    // cutoff — otherwise the tag becomes a bucket label and nothing qualifies.
    const all = [me, ...Array.from({ length: 20 }, (_, i) => row(`r${i}`, ['#rareA', '#rareB'])), ...filler(100, '#padding')];
    expect(relatedRecipes(me, all)).toHaveLength(RELATED_LIMIT);
  });

  it('tolerates a missing recipe or a missing list', () => {
    expect(relatedRecipes(null, [])).toEqual([]);
    expect(relatedRecipes(row('me', ['#a']), null)).toEqual([]);
  });
});

describe('relatedRecipes — against the real catalog', () => {
  it('never suggests a blank recipe or the recipe itself', () => {
    const offenders = [];
    for (const recipe of displayRecipes) {
      for (const match of relatedRecipes(recipe, displayRecipes)) {
        if (match.is_blank !== false || match.id === recipe.id) offenders.push(`${recipe.id} → ${match.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never suggests a same-section recipe that is not a sibling version', () => {
    const offenders = [];
    for (const recipe of displayRecipes) {
      for (const match of relatedRecipes(recipe, displayRecipes)) {
        if (match.section !== recipe.section) continue;
        const parent = String(recipe.id).split('::')[0];
        if (String(match.id).split('::')[0] !== parent) offenders.push(`${recipe.id} → ${match.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is deterministic — the same call twice gives the same order', () => {
    for (const recipe of displayRecipes.slice(0, 40)) {
      const a = relatedRecipes(recipe, displayRecipes).map((r) => r.id);
      expect(relatedRecipes(recipe, displayRecipes).map((r) => r.id)).toEqual(a);
    }
  });
});
