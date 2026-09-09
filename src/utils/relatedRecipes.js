// "What else is like this?" — ranked by shared tags.
//
// Tags come from getEffectiveTags, the SAME source the meta line renders, so
// what a visitor sees listed under a recipe is exactly what the ranking used.
// A second notion of "this recipe's tags" would drift from the visible one and
// make the results look arbitrary.
//
// This also exists to stop the prerendered pages being 216 orphans. Nothing on
// the site linked one recipe to another; a crawler that reached one page found
// no way to any other, and neither did a person with JavaScript off.
import { getEffectiveTags } from './autoTags.js';

export const RELATED_LIMIT = 6;

/**
 * @param recipe  the display row being viewed
 * @param all     every display row, IN FILE ORDER — the order is the final
 *                tie-break, so it has to be stable across builds
 * @returns up to `limit` display rows, best match first; [] when nothing shares
 *          a tag. Never padded: an unrelated recipe presented as related is
 *          worse than an absent section.
 */
export function relatedRecipes(recipe, all, limit = RELATED_LIMIT) {
  if (!recipe || !Array.isArray(all)) return [];
  const mine = new Set(getEffectiveTags(recipe));
  if (mine.size === 0) return [];

  const scored = [];
  all.forEach((candidate, index) => {
    // Itself. Sibling VERSIONS of the same parent are deliberately kept —
    // getting to Version 2 from Version 1 is one of the more useful hops here,
    // and they carry distinct ids (`parent::v2`).
    if (candidate.id === recipe.id) return;
    // A "coming soon" placeholder is a dead end: no ingredients, no method, and
    // no prerendered page behind its link.
    if (candidate.is_blank !== false) return;
    const shared = getEffectiveTags(candidate).filter((tag) => mine.has(tag)).length;
    if (shared === 0) return;
    scored.push({ candidate, shared, sameCategory: candidate.category === recipe.category, index });
  });

  scored.sort((a, b) =>
    b.shared - a.shared
    || Number(b.sameCategory) - Number(a.sameCategory)
    || a.index - b.index);

  return scored.slice(0, limit).map((entry) => entry.candidate);
}
