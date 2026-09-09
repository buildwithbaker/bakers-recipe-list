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

describe('relatedRecipes', () => {
  it('ranks by number of shared tags, most first', () => {
    const me = row('me', ['#a', '#b', '#c']);
    const all = [me, row('one', ['#a']), row('three', ['#a', '#b', '#c']), row('two', ['#a', '#b'])];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['three', 'two', 'one']);
  });

  it('breaks a tie on shared count with the same category', () => {
    const me = row('me', ['#a']);
    const all = [
      me,
      row('other-category', ['#a'], { category: 'Dinner' }),
      row('same-category', ['#a']),
    ];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['same-category', 'other-category']);
  });

  it('breaks a full tie on file order, so the ordering is deterministic', () => {
    const me = row('me', ['#a']);
    const all = [me, row('first', ['#a']), row('second', ['#a']), row('third', ['#a'])];
    expect(relatedRecipes(me, all).map((r) => r.id)).toEqual(['first', 'second', 'third']);
  });

  it('excludes the recipe itself', () => {
    const me = row('me', ['#a']);
    expect(relatedRecipes(me, [me])).toEqual([]);
  });

  it('excludes blank placeholders — a coming-soon link is a dead end', () => {
    const me = row('me', ['#a']);
    const blank = row('blank', ['#a'], { is_blank: true, ingredients: [], instructions: [] });
    expect(relatedRecipes(me, [me, blank])).toEqual([]);
  });

  it('keeps a sibling version of the same parent', () => {
    const me = row('parent::v1', ['#a']);
    const sibling = row('parent::v2', ['#a']);
    expect(relatedRecipes(me, [me, sibling]).map((r) => r.id)).toEqual(['parent::v2']);
  });

  it('returns nothing when no tag is shared, rather than padding', () => {
    const me = row('me', ['#a']);
    const all = [me, row('x', ['#z']), row('y', ['#q'])];
    expect(relatedRecipes(me, all)).toEqual([]);
  });

  it('returns nothing when the recipe itself has no tags', () => {
    const me = row('me', []);
    expect(relatedRecipes(me, [me, row('x', ['#a'])])).toEqual([]);
  });

  it(`caps the list at ${RELATED_LIMIT}`, () => {
    const me = row('me', ['#a']);
    const all = [me, ...Array.from({ length: 20 }, (_, i) => row(`r${i}`, ['#a']))];
    expect(relatedRecipes(me, all)).toHaveLength(RELATED_LIMIT);
  });

  it('tolerates a missing recipe or a missing list', () => {
    expect(relatedRecipes(null, [])).toEqual([]);
    expect(relatedRecipes(row('me', ['#a']), null)).toEqual([]);
  });

  it('never suggests a blank recipe anywhere in the real catalog', () => {
    const offenders = [];
    for (const recipe of displayRecipes) {
      for (const match of relatedRecipes(recipe, displayRecipes)) {
        if (match.is_blank !== false || match.id === recipe.id) offenders.push(`${recipe.id} → ${match.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
