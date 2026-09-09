// "What else is like this?" — cross-section, rarity-weighted, and gated.
//
// Tags come from getEffectiveTags, the SAME source the meta line renders, so
// what a visitor sees listed under a recipe is exactly what the ranking used.
// A second notion of "this recipe's tags" would drift from the visible one and
// make the results look arbitrary.
//
// THREE RULES, each answering a way this went wrong:
//
// 1. RARITY WEIGHTING. The tag vocabulary is lopsided — #marinade is on 124 of
//    the 216 published recipes and #for-review on 118, while 37 of the 68 tags
//    are on exactly one recipe. Counting shared tags equally made "shares
//    #marinade" worth as much as "shares #cardamom". Each shared tag is
//    weighted log(N / freq) instead, so a tag on two recipes counts about ten
//    times a tag on 124. This also demotes #for-review — an internal workflow
//    marker on over half the catalog — without special-casing it.
//
// 2. CROSS-SECTION ONLY. Weighting alone did not help, because it can only
//    re-rank candidates whose shared tag sets DIFFER, and every chicken
//    marinade carries the identical four tags. The result was six neighbours
//    from the section the visitor had just arrived from: a section listing
//    wearing a related-recipes label. The discovery value is across sections,
//    so a recipe's own section is excluded — except its own sibling versions,
//    which live in that section by construction and are one of the more useful
//    hops here.
//
// 3. A FLOOR ON WHAT COUNTS AS A MATCH. One shared bucket label is not
//    evidence. A candidate has to share at least two tags AND at least one of
//    them has to be genuinely distinctive. Below that the section does not
//    render at all — an unrelated recipe presented as related is worse than an
//    absent heading.
//
// This also exists to stop the prerendered pages being 216 orphans. Nothing on
// the site linked one recipe to another; a crawler that reached one page found
// no way to any other, and neither did a person with JavaScript off.
import { getEffectiveTags } from './autoTags.js';

export const RELATED_LIMIT = 6;

// A candidate sharing exactly one tag with the recipe is almost always sharing
// a bucket label — #marinade, #chicken — and nothing more.
export const MIN_SHARED_TAGS = 2;

// A tag carried by more than this share of the published catalog describes
// which drawer a recipe lives in, not what it is like. At least one shared tag
// must be rarer than this, or the match is two bucket labels stacked. Expressed
// as a SHARE, not a count, so it keeps meaning as the collection grows — the
// count is derived from the live frequency map below.
export const DISTINCTIVE_TAG_MAX_SHARE = 0.25;

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
  const table = { freq, published, distinctiveBelow: published * DISTINCTIVE_TAG_MAX_SHARE };
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

// A versioned child carries a derived id like `parent::v1` (expandVersions.js).
const parentOf = (id) => {
  const marker = String(id).indexOf('::');
  return marker === -1 ? null : String(id).slice(0, marker);
};

// Two rows expanded from the SAME record. They necessarily share a section, so
// the cross-section rule has to let them through explicitly or Version 1 could
// never reach Version 2.
function areSiblings(a, b) {
  const parent = parentOf(a);
  return parent !== null && parent === parentOf(b);
}

/**
 * @param recipe  the display row being viewed
 * @param all     every display row, IN FILE ORDER — the order is the final
 *                tie-break, so it has to be stable across builds
 * @returns up to `limit` display rows, best match first; [] when nothing clears
 *          the floor. Never padded.
 */
export function relatedRecipes(recipe, all, limit = RELATED_LIMIT) {
  if (!recipe || !Array.isArray(all)) return [];
  const mine = new Set(getEffectiveTags(recipe));
  if (mine.size === 0) return [];

  const table = tagFrequencies(all);

  const scored = [];
  all.forEach((candidate, index) => {
    if (candidate.id === recipe.id) return;
    // A "coming soon" placeholder is a dead end: no ingredients, no method, and
    // no prerendered page behind its link.
    if (candidate.is_blank !== false) return;
    // The visitor came from this section. Its neighbours are one tap away in
    // the list they just left — except a sibling version, which is not.
    if (candidate.section === recipe.section && !areSiblings(recipe.id, candidate.id)) return;

    // Sorted so an identical set of shared tags always sums in the same order
    // and therefore to the same float. Without that, two candidates sharing the
    // same tags could differ in the last bit and jump the file-order tie-break.
    const shared = [...new Set(getEffectiveTags(candidate))].filter((tag) => mine.has(tag)).sort();
    if (shared.length < MIN_SHARED_TAGS) return;
    // At least one shared tag has to actually mean something.
    if (!shared.some((tag) => (table.freq.get(tag) || 0) < table.distinctiveBelow)) return;

    const score = shared.reduce((sum, tag) => sum + tagWeight(tag, table), 0);
    if (score <= 0) return;

    scored.push({ candidate, score, sameCategory: candidate.category === recipe.category, index });
  });

  scored.sort((a, b) =>
    b.score - a.score
    || Number(b.sameCategory) - Number(a.sameCategory)
    || a.index - b.index);

  return scored.slice(0, limit).map((entry) => entry.candidate);
}
