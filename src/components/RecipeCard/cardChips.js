// The tag chips on a recipe card: at most three, Method > Plan > Diet >
// Protein (tag criteria, "Card rule"). Cuisine, dish type, dish form,
// sub-cuisine, collections, #spicy and #new are never chips, and neither is a
// tag that only repeats the card's category label (#slow-cooker on a Slow
// Cooker card).
import { CARD_FACETS, facetOf } from '../../data/tagFacets.js';

export const MAX_CHIPS = 3;

// "Slow Cooker" -> "#slow-cooker", to compare a label with a tag.
const asTag = (label) => `#${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/** "#one-pan" -> "One pan". */
export function chipLabel(tag) {
  const words = tag.replace(/^#/, '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The chips for a card, from its effective tags (manual + auto).
 * Within a facet the tags keep the order they came in.
 * @param {string[]} tags
 * @param {string} [categoryLabel] the card's category label
 * @returns {string[]} tags, at most MAX_CHIPS
 */
export function cardChips(tags, categoryLabel) {
  const repeat = categoryLabel ? asTag(categoryLabel) : null;
  const rank = (t) => CARD_FACETS.indexOf(facetOf(t));
  return [...new Set(tags ?? [])]
    .filter((t) => t !== repeat && rank(t) !== -1)
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, MAX_CHIPS)
    .map(({ t }) => t);
}
