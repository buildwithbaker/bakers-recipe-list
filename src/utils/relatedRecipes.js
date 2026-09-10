// "What else is like this?" — scored on INGREDIENT OVERLAP.
//
// WHY NOT TAGS. The previous version ranked by shared tags and could not be
// made to work, for a reason that is structural rather than a tuning problem:
// there are only ~68 tags, roughly half sit on exactly one recipe and so can
// never be *shared*, and most of the rest are drawer labels. Every chicken
// marinade carries the identical four tags, so a scoring function had nothing
// to separate them by and file order silently picked the results.
// Cross-section exclusion and a distinctiveness floor made that shippable, but
// they were scaffolding around a signal that could not discriminate.
//
// Ingredients can. The catalog has hundreds of distinct ingredient tokens
// against 68 tags, they are already authored on every real recipe, and they
// describe the food rather than the drawer it lives in. Two recipes sharing
// gochujang and fish sauce are genuinely related; two sharing #marinade are
// not. It also finds pairs tags structurally cannot — Beef Stew and Pork Stew
// are the same dish with a different protein, sharing both a section and most
// of a shopping list.
//
// The rarity principle carries over unchanged: a shared token is worth
// log(N / documentFrequency), so `gochujang` counts far more than `garlic`.
// What changed is the vocabulary it runs over.

export const RELATED_LIMIT = 6;

// Below this, what is left after stripping quantities is noise. Units and
// measures are handled by STOPWORDS; this catches the debris.
export const TOKEN_MIN_LENGTH = 3;

// A candidate must clear this summed score to be shown at all. Chosen by
// sweeping thresholds against the real catalog and reading the resulting lists,
// not by picking a round number: below it, matches built purely on pantry
// staples start appearing; above it, genuinely related recipes start dropping.
// Re-sweep if the tokeniser or STOPWORDS change — the three move together.
export const MIN_SCORE = 10;

// THE TUNING KNOB. Words that appear in ingredient lines but say nothing about
// what a dish IS: measurements, quantities, preparation instructions, and the
// handful of pantry items so universal that sharing them is not evidence.
//
// Everything else is deliberately left in, to be discounted by the rarity
// weighting instead. `garlic` and `onion` are common but not universal, so they
// should count for a little; zeroing them here would override a judgement the
// frequency map already makes better, and makes it. Only add a word that is
// genuinely contentless — and re-run the threshold sweep afterwards.
export const STOPWORDS = new Set([
  // measurements and containers
  'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon',
  'teaspoons', 'ounce', 'ounces', 'pound', 'pounds', 'gram', 'grams',
  'kilogram', 'liter', 'liters', 'litre', 'quart', 'quarts', 'pint', 'pints',
  'gallon', 'inch', 'inches', 'can', 'cans', 'jar', 'jars', 'package',
  'packages', 'packet', 'packets', 'container', 'bottle', 'box', 'slice',
  'slices', 'piece', 'pieces', 'stalk', 'stalks', 'sprig', 'sprigs', 'clove',
  'cloves', 'head', 'bunch', 'bunches', 'pinch', 'dash', 'handful', 'stick',
  'sticks', 'strip', 'strips',
  // quantities and hedges
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'half', 'quarter', 'about', 'approximately', 'plus', 'minus', 'more',
  'less', 'optional', 'needed', 'taste', 'each', 'total', 'per',
  // preparation and state
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded', 'crushed',
  'ground', 'peeled', 'seeded', 'deseeded', 'trimmed', 'cubed', 'halved',
  'quartered', 'thinly', 'thin', 'finely', 'fine', 'coarsely', 'roughly',
  'large', 'medium', 'small', 'extra', 'fresh', 'freshly', 'dried', 'frozen',
  'canned', 'jarred', 'cooked', 'uncooked', 'raw', 'whole', 'boneless',
  'skinless', 'lean', 'softened', 'melted', 'room', 'temperature', 'divided',
  'packed', 'rinsed', 'drained', 'beaten', 'warm', 'cold', 'hot', 'washed',
  'cut', 'into', 'and', 'the', 'for', 'with', 'plain', 'low', 'reduced',
  'unsalted', 'salted', 'granulated', 'pure', 'good', 'quality', 'ripe',
  // the universal pantry — in so much of the catalog that sharing them
  // carries no information at all
  'salt', 'pepper', 'water', 'oil', 'olive', 'vegetable', 'canola', 'kosher',
  'black', 'sea', 'table',
  // BRANDS AND GRADES. These were the worst offenders found while tuning: they
  // are RARE, so the rarity weighting scored them at the very top, and they
  // signal nothing but which salt the author happens to buy. Two recipes both
  // written as "Diamond Crystal kosher salt" were scoring a large bonus for
  // agreeing about a brand. Anything naming a producer belongs here.
  'diamond', 'crystal', 'morton', 'virgin', 'coarse', 'flaky',
  // MORE PREPARATION AND PROSE. Same failure as the brands — rare enough to
  // dominate a score, contentless as a description of a dish. "reserved pasta
  // water", "smashed garlic", "stems removed".
  'smashed', 'cracked', 'dice', 'removed', 'reserved', 'sized', 'torn',
  'stemmed', 'cored', 'pitted', 'shaved', 'crumbled', 'separated', 'discarded',
  'drizzle', 'splash', 'squeeze', 'lbs',
  // GENERIC ADJECTIVES. Modifiers that attach to anything and describe nothing.
  'natural', 'neutral', 'smooth', 'high', 'flat', 'only', 'hand', 'old',
  'best', 'favorite', 'favourite', 'store', 'bought', 'homemade', 'thick',
  'long', 'short', 'light', 'dark',
]);

// Tokenised once per candidate list and cached by the array itself — the same
// build-the-map-once shape as recipeIndex.js. The app's stable displayRecipes
// is tokenised exactly once at first use, while a test fixture still gets a
// vocabulary of its own. 216x216 is trivial, but not per render.
const modelCache = new WeakMap();

// An ingredient list → the words in it that might mean something.
export function tokenizeIngredients(recipe) {
  const tokens = new Set();
  for (const ingredient of recipe?.ingredients || []) {
    // Only real items: a `section`/`header` marker is a sub-heading, not food.
    if (ingredient.type !== 'item') continue;
    const cleaned = String(ingredient.text)
      .toLowerCase()
      // "(about 2 lb)", "(optional)" — asides, never the ingredient itself.
      .replace(/\([^)]*\)/g, ' ')
      // Digits, unicode fractions, punctuation and hyphens all go at once.
      .replace(/[^a-z]+/g, ' ');
    for (const token of cleaned.split(' ')) {
      if (token.length < TOKEN_MIN_LENGTH) continue;
      if (STOPWORDS.has(token)) continue;
      tokens.add(token);
    }
  }
  return tokens;
}

function buildModel(all) {
  const cached = modelCache.get(all);
  if (cached) return cached;

  const tokensById = new Map();
  const df = new Map();
  let published = 0;

  for (const recipe of all) {
    // Blanks are never candidates, so they must not shape the frequencies
    // either — they carry no ingredients, but the N they would add is not zero.
    if (recipe.is_blank !== false) continue;
    published += 1;
    const tokens = tokenizeIngredients(recipe);
    tokensById.set(recipe.id, tokens);
    for (const token of tokens) df.set(token, (df.get(token) || 0) + 1);
  }

  const model = { tokensById, df, published };
  modelCache.set(all, model);
  return model;
}

// log(N / df). A token on every published recipe scores 0 — it distinguishes
// nothing, so sharing it is not evidence of anything.
function tokenWeight(token, { df, published }) {
  const seen = df.get(token) || 0;
  if (seen <= 0 || published <= 0) return 0;
  return Math.log(published / seen);
}

// A versioned child carries a derived id like `parent::v1` (expandVersions.js).
const parentOf = (id) => {
  const marker = String(id).indexOf('::');
  return marker === -1 ? null : String(id).slice(0, marker);
};

// Two rows expanded from the SAME record: related by construction rather than
// by inference, so the scoring does not judge them at all.
function areSiblings(a, b) {
  const parent = parentOf(a);
  return parent !== null && parent === parentOf(b);
}

/**
 * @param recipe    the display row being viewed
 * @param all       every display row, IN FILE ORDER — the order is the final
 *                  tie-break, so it has to be stable across builds
 * @param limit     how many to return
 * @param minScore  override for the score floor. Exposed for the threshold
 *                  sweep and for tests; callers should use the default.
 * @returns up to `limit` display rows, best match first; [] when nothing clears
 *          the floor. Never padded — an unrelated recipe presented as related
 *          is worse than an absent heading.
 */
export function relatedRecipes(recipe, all, limit = RELATED_LIMIT, minScore = MIN_SCORE) {
  if (!recipe || !Array.isArray(all)) return [];

  const model = buildModel(all);
  // A row that is not itself published (a blank being viewed) still gets
  // sensible results rather than none.
  const mine = model.tokensById.get(recipe.id) ?? tokenizeIngredients(recipe);

  const scored = [];
  all.forEach((candidate, index) => {
    if (candidate.id === recipe.id) return;
    // A "coming soon" placeholder is a dead end: no ingredients, no method and
    // no prerendered page behind its link. The one rule siblings do not escape.
    if (candidate.is_blank !== false) return;

    const sibling = areSiblings(recipe.id, candidate.id);

    let score = 0;
    if (!sibling) {
      if (mine.size === 0) return;
      const theirs = model.tokensById.get(candidate.id);
      if (!theirs || theirs.size === 0) return;
      // Sorted so an identical set of shared tokens always sums in the same
      // order, and therefore to the same float. Without that, two candidates
      // sharing the same tokens could differ in the last bit and jump the
      // file-order tie-break that is supposed to make this reproducible.
      const shared = [...theirs].filter((token) => mine.has(token)).sort();
      if (shared.length === 0) return;
      score = shared.reduce((sum, token) => sum + tokenWeight(token, model), 0);
      if (score < minScore) return;
    }

    scored.push({ candidate, sibling, score, index });
  });

  scored.sort((a, b) => {
    // Siblings first, and among themselves in file order — which is version
    // order, so Version 2 never lands above Version 1 on an ingredient accident.
    if (a.sibling !== b.sibling) return a.sibling ? -1 : 1;
    if (a.sibling) return a.index - b.index;
    return b.score - a.score || a.index - b.index;
  });

  return scored.slice(0, limit).map((entry) => entry.candidate);
}
