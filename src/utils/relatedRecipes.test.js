import { describe, it, expect } from 'vitest';
import {
  relatedRecipes, tokenizeIngredients, RELATED_LIMIT, MIN_SCORE, STOPWORDS, TOKEN_MIN_LENGTH,
} from './relatedRecipes.js';
import { displayRecipes } from '../data/recipeIndex.js';

// Fixtures carry their ingredients as plain lines. Sections and tags are
// irrelevant to the ranking now — that is the point of the change — so they are
// only set where a test is about siblings or blanks.
const row = (id, items, extra = {}) => ({
  id,
  name: id,
  section: `SECTION-${id}`,
  category: 'Breakfast',
  source: 'Original',
  tags: [],
  ingredients: items.map((text) => ({ type: 'item', text })),
  instructions: [{ step: 'Cook', detail: 'Cook it.' }],
  is_blank: false,
  ...extra,
});

// Filler carrying `word`, to push its document frequency up and its weight down
// without ever matching the recipe under test.
const filler = (n, word, prefix = 'f') =>
  Array.from({ length: n }, (_, i) => row(`${prefix}-${i}`, [`1 cup ${word}`]));

describe('tokenizeIngredients', () => {
  it('lowercases, strips quantities and punctuation, and splits on whitespace', () => {
    const tokens = tokenizeIngredients(row('r', ['2.5 lb Beef Chuck Roast']));
    expect([...tokens].sort()).toEqual(['beef', 'chuck', 'roast']);
  });

  it('drops parentheticals — they are asides, not the ingredient', () => {
    const tokens = tokenizeIngredients(row('r', ['1 lb pork shoulder (about 2 nice pieces)']));
    expect(tokens.has('pork')).toBe(true);
    expect(tokens.has('shoulder')).toBe(true);
    expect(tokens.has('nice')).toBe(false);
  });

  it('drops unicode fractions and digits with the rest of the punctuation', () => {
    const tokens = tokenizeIngredients(row('r', ['½ cup gochujang', '1-inch piece ginger']));
    expect([...tokens].sort()).toEqual(['ginger', 'gochujang']);
  });

  it(`drops tokens shorter than ${TOKEN_MIN_LENGTH}`, () => {
    expect(tokenizeIngredients(row('r', ['1 oz rum'])).has('rum')).toBe(true);
    expect(tokenizeIngredients(row('r', ['2 t soy'])).has('t')).toBe(false);
  });

  it('drops STOPWORDS, including the salt brands that used to dominate scores', () => {
    const tokens = tokenizeIngredients(row('r', [
      '1 tsp Diamond Crystal kosher salt',
      '2 tbsp reserved pasta cooking water',
    ]));
    for (const junk of ['diamond', 'crystal', 'kosher', 'salt', 'reserved', 'water', 'tsp', 'tbsp']) {
      expect([junk, tokens.has(junk)]).toEqual([junk, false]);
    }
    expect(tokens.has('pasta')).toBe(true);
  });

  it('ignores section and header markers — a sub-heading is not food', () => {
    const recipe = {
      ...row('r', ['1 cup rice']),
      ingredients: [
        { type: 'section', text: 'Version 1 - Serious Eats' },
        { type: 'header', text: 'For the sauce' },
        { type: 'item', text: '1 cup rice' },
      ],
    };
    expect([...tokenizeIngredients(recipe)]).toEqual(['rice']);
  });
});

describe('relatedRecipes — ingredient overlap', () => {
  it('ranks a rare shared ingredient above a common one', () => {
    const me = row('me', ['gochujang', 'chicken', 'ginger']);
    const all = [
      me,
      row('rare-match', ['gochujang', 'ginger']),
      row('common-match', ['chicken', 'ginger']),
      ...filler(40, 'chicken'),
    ];
    expect(relatedRecipes(me, all, 6, 0)[0].id).toBe('rare-match');
  });

  it('scores nothing for a candidate sharing only STOPWORDS', () => {
    const me = row('me', ['1 tsp kosher salt', '2 tbsp olive oil', 'gochujang']);
    const other = row('other', ['1 tsp kosher salt', '2 tbsp olive oil']);
    expect(relatedRecipes(me, [me, other, ...filler(20, 'rice')], 6, 0)).toEqual([]);
  });

  it('drops a candidate below the score floor', () => {
    const me = row('me', ['saffron', 'cardamom']);
    const weak = row('weak', ['saffron']);
    const all = [me, weak, ...filler(20, 'rice')];
    expect(relatedRecipes(me, all, 6, 0).map((r) => r.id)).toEqual(['weak']);
    expect(relatedRecipes(me, all, 6, 1000)).toEqual([]);
  });

  it("is not confined to the recipe's own section — the best match may share it", () => {
    // Beef Stew / Pork Stew is the real case: same section, same dish.
    const me = row('me', ['gochujang', 'ginger'], { section: 'SHARED' });
    const neighbour = row('neighbour', ['gochujang', 'ginger'], { section: 'SHARED' });
    expect(relatedRecipes(me, [me, neighbour, ...filler(20, 'rice')], 6, 0).map((r) => r.id))
      .toEqual(['neighbour']);
  });
});

describe('relatedRecipes — siblings', () => {
  it('puts siblings first, ahead of a stronger inferred match, in version order', () => {
    const me = row('parent::v2', ['gochujang', 'ginger'], { section: 'SHARED' });
    const v1 = row('parent::v1', ['rice'], { section: 'SHARED' });
    const v3 = row('parent::v3', ['rice'], { section: 'SHARED' });
    const best = row('best', ['gochujang', 'ginger']);
    expect(relatedRecipes(me, [v1, me, v3, best, ...filler(20, 'rice')], 6, 0).map((r) => r.id))
      .toEqual(['parent::v1', 'parent::v3', 'best']);
  });

  it('keeps a sibling that shares no ingredients at all', () => {
    const me = row('parent::v1', ['gochujang']);
    const sibling = row('parent::v2', ['nothing', 'alike']);
    expect(relatedRecipes(me, [me, sibling, ...filler(20, 'rice')]).map((r) => r.id))
      .toEqual(['parent::v2']);
  });

  it('does not treat two unrelated versioned rows as siblings', () => {
    const me = row('alpha::v1', ['gochujang']);
    const other = row('beta::v1', ['unrelated']);
    expect(relatedRecipes(me, [me, other, ...filler(20, 'rice')])).toEqual([]);
  });

  it('still drops a BLANK sibling — the one rule siblings do not escape', () => {
    const me = row('parent::v1', ['gochujang']);
    const blank = row('parent::v2', [], { is_blank: true, ingredients: [], instructions: [] });
    expect(relatedRecipes(me, [me, blank, ...filler(20, 'rice')])).toEqual([]);
  });
});

describe('relatedRecipes — exclusions, ordering, limits', () => {
  it('excludes the recipe itself', () => {
    const me = row('me', ['gochujang']);
    expect(relatedRecipes(me, [me, ...filler(20, 'rice')], 6, 0)).toEqual([]);
  });

  it('excludes blanks, and does not let them shape the frequencies', () => {
    const me = row('me', ['gochujang', 'ginger']);
    const blanks = Array.from({ length: 30 }, (_, i) =>
      row(`b-${i}`, [], { is_blank: true, ingredients: [], instructions: [] }));
    const match = row('match', ['gochujang', 'ginger']);
    expect(relatedRecipes(me, [me, match, ...blanks, ...filler(20, 'rice')], 6, 0).map((r) => r.id))
      .toEqual(['match']);
  });

  it('breaks a score tie on file order, so ordering is reproducible across builds', () => {
    const me = row('me', ['gochujang', 'ginger']);
    const all = [me, row('first', ['gochujang', 'ginger']), row('second', ['gochujang', 'ginger']),
      row('third', ['gochujang', 'ginger']), ...filler(20, 'rice')];
    expect(relatedRecipes(me, all, 6, 0).map((r) => r.id)).toEqual(['first', 'second', 'third']);
  });

  it('gives an identical shared set an identical score whatever order the lines are in', () => {
    const me = row('me', ['saffron', 'cardamom', 'tamarind']);
    const all = [me,
      row('forwards', ['saffron', 'cardamom', 'tamarind']),
      row('backwards', ['tamarind', 'cardamom', 'saffron']),
      ...filler(20, 'rice')];
    expect(relatedRecipes(me, all, 6, 0).map((r) => r.id)).toEqual(['forwards', 'backwards']);
  });

  it(`caps the list at ${RELATED_LIMIT}`, () => {
    const me = row('me', ['gochujang', 'ginger']);
    const all = [me, ...Array.from({ length: 20 }, (_, i) => row(`m-${i}`, ['gochujang', 'ginger'])),
      ...filler(40, 'rice')];
    expect(relatedRecipes(me, all, RELATED_LIMIT, 0)).toHaveLength(RELATED_LIMIT);
  });

  it('renders nothing rather than padding when nothing qualifies', () => {
    const me = row('me', ['gochujang']);
    expect(relatedRecipes(me, [me, row('x', ['unrelated']), ...filler(20, 'rice')])).toEqual([]);
  });

  it('tolerates a missing recipe, a missing list, and a recipe with no ingredients', () => {
    expect(relatedRecipes(null, [])).toEqual([]);
    expect(relatedRecipes(row('me', ['gochujang']), null)).toEqual([]);
    const empty = row('empty', []);
    expect(relatedRecipes(empty, [empty, row('x', ['gochujang']), ...filler(20, 'rice')])).toEqual([]);
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

  it('finds Pork Stew for Beef Stew — the pair tags structurally could not', () => {
    const beefStew = displayRecipes.find((r) => r.id === 'beef-stew');
    expect(relatedRecipes(beefStew, displayRecipes).map((r) => r.name)[0]).toBe('Pork Stew');
  });

  it('reaches the beef and pork versions of a chicken marinade', () => {
    const chipotle = displayRecipes.find((r) => r.id === 'chipotle-lime-chicken-marinade::v1');
    const names = relatedRecipes(chipotle, displayRecipes).map((r) => r.name).join(' | ');
    expect(names).toMatch(/Chipotle-Lime/);
  });

  it('is deterministic — the same call twice gives the same order', () => {
    for (const recipe of displayRecipes.slice(0, 40)) {
      const a = relatedRecipes(recipe, displayRecipes).map((r) => r.id);
      expect(relatedRecipes(recipe, displayRecipes).map((r) => r.id)).toEqual(a);
    }
  });

  it('keeps the tuning knobs where a reader can find them', () => {
    expect(MIN_SCORE).toBeGreaterThan(0);
    expect(STOPWORDS.has('salt')).toBe(true);
    expect(STOPWORDS.has('gochujang')).toBe(false);
  });
});
