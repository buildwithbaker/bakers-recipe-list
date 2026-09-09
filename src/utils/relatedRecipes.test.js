import { describe, it, expect } from 'vitest';
import { relatedRecipes, RELATED_LIMIT } from './relatedRecipes.js';
import { displayRecipes } from '../data/recipeIndex.js';

// The section is deliberately one that SECTION_TAG_MAP does not know, and the
// ingredient deliberately triggers no protein or spicy rule, so getEffectiveTags
// returns exactly the tags the fixture declares. A mapped section (BREAKFAST,
// say) would silently give every row a shared `#breakfast` and the "nothing is
// related" case could never be reached.
const row = (id, tags, extra = {}) => ({
  id,
  name: id,
  section: 'UNMAPPED-TEST-SECTION',
  category: 'Breakfast',
  source: 'Original',
  tags,
  ingredients: [{ type: 'item', text: '1 egg' }],
  instructions: [{ step: 'Cook', detail: 'Cook it.' }],
  is_blank: false,
  ...extra,
});

// Padding that carries a tag, so the tag's frequency is high and its weight low
// without those rows ever matching the recipe under test.
const commonFiller = (n, tag) => Array.from({ length: n }, (_, i) => row(`filler-${tag}-${i}`, [tag]));

describe('relatedRecipes — rarity weighting', () => {
  it('prefers one RARE shared tag over several common ones', () => {
    // #common is on 20+ rows, #rare on just the two that share it.
    const me = row('me', ['#common', '#alsocommon', '#rare']);
    const all = [
      me,
      row('shares-two-common', ['#common', '#alsocommon']),
      row('shares-one-rare', ['#rare']),
      ...commonFiller(20, '#common'),
      ...commonFiller(20, '#alsocommon'),
    ];
    expect(relatedRecipes(me, all).slice(0, 2).map((r) => r.id))
      .toEqual(['shares-one-rare', 'shares-two-common']);
  });

  it('still adds weights up, so more rare tags beat one rare tag', () => {
    const me = row('me', ['#rareA', '#rareB']);
    const all = [me, row('one-rare', ['#rareA']), row('two-rare', ['#rareA', '#rareB']), ...commonFiller(20, '#x')];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['two-rare', 'one-rare']);
  });

  it('ignores a tag carried by every published recipe — it is evidence of nothing', () => {
    const me = row('me', ['#universal']);
    const all = [me, row('a', ['#universal']), row('b', ['#universal'])];
    expect(relatedRecipes(me, all)).toEqual([]);
  });

  it('does not let blank records shape the weights', () => {
    // 20 blanks carrying #rare must not make #rare look common.
    const me = row('me', ['#rare']);
    const blanks = Array.from({ length: 20 }, (_, i) =>
      row(`blank-${i}`, ['#rare'], { is_blank: true, ingredients: [], instructions: [] }));
    const all = [me, row('match', ['#rare']), ...blanks, ...commonFiller(20, '#x')];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['match']);
  });
});

describe('relatedRecipes — ordering and exclusions', () => {
  it('breaks a tie on score with the same category', () => {
    const me = row('me', ['#rare']);
    const all = [
      me,
      row('other-category', ['#rare'], { category: 'Dinner' }),
      row('same-category', ['#rare']),
      ...commonFiller(20, '#x'),
    ];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['same-category', 'other-category']);
  });

  it('breaks a full tie on file order, so the ordering is deterministic', () => {
    const me = row('me', ['#rare']);
    const all = [me, row('first', ['#rare']), row('second', ['#rare']), row('third', ['#rare']), ...commonFiller(20, '#x')];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['first', 'second', 'third']);
  });

  it('gives an identical shared-tag set an identical score, whatever order the tags are in', () => {
    const me = row('me', ['#p', '#q', '#r']);
    const all = [
      me,
      row('forwards', ['#p', '#q', '#r']),
      row('backwards', ['#r', '#q', '#p']),
      ...commonFiller(20, '#x'),
    ];
    // Equal scores, equal category — so file order decides, not float noise.
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['forwards', 'backwards']);
  });

  it('excludes the recipe itself', () => {
    const me = row('me', ['#rare']);
    expect(relatedRecipes(me, [me, ...commonFiller(20, '#x')])).toEqual([]);
  });

  it('excludes blank placeholders — a coming-soon link is a dead end', () => {
    const me = row('me', ['#rare']);
    const blank = row('blank', ['#rare'], { is_blank: true, ingredients: [], instructions: [] });
    expect(relatedRecipes(me, [me, blank, ...commonFiller(20, '#x')])).toEqual([]);
  });

  it('keeps a sibling version of the same parent', () => {
    const me = row('parent::v1', ['#rare']);
    const sibling = row('parent::v2', ['#rare']);
    expect(relatedRecipes(me, [me, sibling, ...commonFiller(20, '#x')]).map((r) => r.id))
      .toEqual(['parent::v2']);
  });

  it('returns nothing when no tag is shared, rather than padding', () => {
    const me = row('me', ['#a']);
    const all = [me, row('x', ['#z']), row('y', ['#q']), ...commonFiller(20, '#x')];
    expect(relatedRecipes(me, all)).toEqual([]);
  });

  it('returns nothing when the recipe itself has no tags', () => {
    const me = row('me', []);
    expect(relatedRecipes(me, [me, row('x', ['#a'])])).toEqual([]);
  });

  it(`caps the list at ${RELATED_LIMIT}`, () => {
    const me = row('me', ['#rare']);
    const all = [me, ...Array.from({ length: 20 }, (_, i) => row(`r${i}`, ['#rare'])), ...commonFiller(40, '#x')];
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

  it('is deterministic — the same call twice gives the same order', () => {
    for (const recipe of displayRecipes.slice(0, 40)) {
      const a = relatedRecipes(recipe, displayRecipes).map((r) => r.id);
      const b = relatedRecipes(recipe, displayRecipes).map((r) => r.id);
      expect(b).toEqual(a);
    }
  });
});
