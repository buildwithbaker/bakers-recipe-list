// "What else is like this?" — ranked by RARITY-WEIGHTED shared tags.
//
// Tags come from getEffectiveTags, the SAME source the meta line renders, so
// what a visitor sees listed under a recipe is exactly what the ranking used.
// A second notion of "this recipe's tags" would drift from the visible one and
// make the results look arbitrary.
//
// WHY NOT A PLAIN SHARED-TAG COUNT: the tag vocabulary is wildly lopsided.
// #marinade is on 124 of the 216 published recipes and #for-review on 118, while
// 37 of the 68 tags are on exactly one recipe. Counting shared tags equally
// meant "shares #marinade" scored the same as "shares #cardamom", so almost
// every marinade tied with almost every other marinade and the tie-break — file
// order — silently decided the results. That is a section listing wearing a
// related-recipes label.
//
// So each shared tag is weighted by inverse document frequency, log(N / freq):
// a tag on 2 recipes is worth about ten times a tag on 124. This also demotes
// #for-review on its own, without special-casing it — a marker carried by half
// the catalog earns almost nothing, which is exactly what it is worth.
//
// This also exists to stop the prerendered pages being 216 orphans. Nothing on
// the site linked one recipe to another; a crawler that reached one page found
// no way to any other, and neither did a person with JavaScript off.
import { getEffectiveTags } from './autoTags.js';

export const RELATED_LIMIT = 6;

// Frequencies are a property of the catalog, not of one lookup, so they are
// computed once per candidate list and reused — the same "build the map once"
// shape as recipeIndex.js. Keyed by the array itself, so the app's stable
// displayRecipes is computed exactly once at first use while a test fixture
// still gets frequencies of its own.
const frequencyCache = new WeakMap();

function tagFrequencies(all) {
  const cached = frequencyCache.get(all);
  if (cached) return cached;
  const freq = new Map();
  let published = 0;
  for (const candidate of all) {
    // Blanks are never candidates, so they must not shape the weights either.
    if (candidate.is_blank !== false) continue;
    published += 1;
    for (const tag of new Set(getEffectiveTags(candidate))) {
      freq.set(tag, (freq.get(tag) || 0) + 1);
    }
  }
  const table = { freq, published };
  frequencyCache.set(all, table);
  return table;
}

// log(N / freq). A tag on every published recipe scores 0 — it distinguishes
// nothing, so sharing it is not evidence of anything.
function tagWeight(tag, { freq, published }) {
  const seen = freq.get(tag) || 0;
  if (seen <= 0 || published <= 0) return 0;
  return Math.log(published / seen);
}

/**
 * @param recipe  the display row being viewed
 * @param all     every display row, IN FILE ORDER — the order is the final
 *                tie-break, so it has to be stable across builds
 * @returns up to `limit` display rows, best match first; [] when nothing shares
 *          a tag that carries any weight. Never padded: an unrelated recipe
 *          presented as related is worse than an absent section.
 */
export function relatedRecipes(recipe, all, limit = RELATED_LIMIT) {
  if (!recipe || !Array.isArray(all)) return [];
  const mine = new Set(getEffectiveTags(recipe));
  if (mine.size === 0) return [];

  const table = tagFrequencies(all);

  const scored = [];
  all.forEach((candidate, index) => {
    // Itself. Sibling VERSIONS of the same parent are deliberately kept —
    // getting to Version 2 from Version 1 is one of the more useful hops here,
    // and they carry distinct ids (`parent::v2`).
    if (candidate.id === recipe.id) return;
    // A "coming soon" placeholder is a dead end: no ingredients, no method, and
    // no prerendered page behind its link.
    if (candidate.is_blank !== false) return;

    // Sorted so an identical set of shared tags always sums in the same order
    // and therefore to the same float. Without that, two candidates sharing the
    // same tags could differ in the last bit and jump the file-order tie-break.
    const shared = [...new Set(getEffectiveTags(candidate))].filter((tag) => mine.has(tag)).sort();
    if (shared.length === 0) return;
    const score = shared.reduce((sum, tag) => sum + tagWeight(tag, table), 0);
    // Everything shared is carried by the whole catalog: no evidence at all.
    if (score <= 0) return;

    scored.push({ candidate, score, sameCategory: candidate.category === recipe.category, index });
  });

  scored.sort((a, b) =>
    b.score - a.score
    || Number(b.sameCategory) - Number(a.sameCategory)
    || a.index - b.index);

  return scored.slice(0, limit).map((entry) => entry.candidate);
}
