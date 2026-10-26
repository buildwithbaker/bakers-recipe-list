// Search: one query across the Cookbook and Chef's Drafts.
//
// Three modes, picked with the Name / Ingredient / All toggle beside the box:
//
//   all         the query appears anywhere in the name, any ingredient line,
//               any tag (manual or auto-derived), the source, or the category
//               label. Plain substring matching.
//   name        the query appears in the recipe name. Substring, as in `all`.
//   ingredient  the query matches whole words in a `type: "item"` ingredient
//               line. Plural-tolerant ("tomato" finds "tomatoes", "berries"
//               finds "berry"); several words match as a phrase ("red onion").
//               A match followed straight away by "powder" or "salt" does not
//               count unless the query has that word too, so "onion" skips
//               "onion powder" and "garlic" skips "garlic salt", but "onion
//               powder" finds it.
//
// Every mode is case- and accent-insensitive, so "jalapeno" finds "jalapeño".
//
// Coming-soon placeholders are left out: they have no page and no ingredients,
// so a result that opens onto "coming soon" answers nothing.
import { getEffectiveTags } from './autoTags.js';
import { isComingSoon } from './recipeKinds.js';
import { categoryOf } from '../data/catalog.js';

export const SEARCH_MODES = Object.freeze({ ALL: 'all', NAME: 'name', INGREDIENT: 'ingredient' });

export function normaliseText(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Words that, straight after a match, turn an ingredient into a different
// one: "onion powder" is not an onion.
const QUALIFIERS = ['powder', 'salt'];

// Every form a word could take with a plural ending removed, the word itself
// included. Two words are the same word when their forms meet, which makes the
// test symmetric: "berries" and "berry" share "berry", "tomatoes" and
// "tomato" share "tomato", "cookies" and "cookie" share "cookie". A stem
// shorter than three letters is never produced, so "has" is not "ha".
function forms(word) {
  const out = new Set([word]);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length - 1 >= 3) out.add(word.slice(0, -1));
  if (word.endsWith('es') && word.length - 2 >= 3) out.add(word.slice(0, -2));
  if (word.endsWith('ies') && word.length - 3 >= 3) out.add(`${word.slice(0, -3)}y`);
  return out;
}

function sameWord(a, b) {
  if (a === b) return true;
  const fb = forms(b);
  for (const f of forms(a)) if (fb.has(f)) return true;
  return false;
}

// The words of a piece of text, with where each one sits, so the gap between
// two words can be checked.
function words(text) {
  return [...normaliseText(text).matchAll(/[a-z0-9]+/g)].map((m) => ({ w: m[0], start: m.index, end: m.index + m[0].length }));
}

/** True when an ingredient line matches the query by the `ingredient` rules above. */
export function ingredientLineMatches(line, query) {
  const q = words(query).map((t) => t.w);
  if (!q.length) return false;
  const text = normaliseText(line);
  const l = words(line);
  const queryHas = (word) => q.some((w) => sameWord(w, word));
  for (let i = 0; i + q.length <= l.length; i++) {
    if (!q.every((w, j) => sameWord(w, l[i + j].w))) continue;
    const last = l[i + q.length - 1];
    const next = l[i + q.length];
    const qualified = next
      && /^\s+$/.test(text.slice(last.end, next.start))
      && QUALIFIERS.some((x) => sameWord(x, next.w) && !queryHas(x));
    if (!qualified) return true;
  }
  return false;
}

const itemLines = (recipe) => (recipe.ingredients ?? []).filter((ing) => ing.type === 'item');

/**
 * Why a recipe matches, or null when it does not.
 * `matchedLine` is what a result card shows under the title: the first
 * matching ingredient line, "tag #x", "source: x" or "category: x". A name hit
 * needs no explanation, so it has none.
 * @returns {{ field: 'name'|'ingredient'|'tag'|'source'|'category', matchedLine?: string } | null}
 */
export function matchRecipe(recipe, query, mode = SEARCH_MODES.ALL) {
  const q = normaliseText(query).trim();
  if (!q) return { field: 'name' };
  const has = (s) => normaliseText(s).includes(q);

  if (mode === SEARCH_MODES.NAME) return has(recipe.name) ? { field: 'name' } : null;

  if (mode === SEARCH_MODES.INGREDIENT) {
    const line = itemLines(recipe).find((ing) => ingredientLineMatches(ing.text, query));
    return line ? { field: 'ingredient', matchedLine: line.text } : null;
  }

  if (has(recipe.name)) return { field: 'name' };
  const line = recipe.ingredients?.find((ing) => has(ing.text));
  if (line) return { field: 'ingredient', matchedLine: line.text };
  const tag = getEffectiveTags(recipe).find(has);
  if (tag) return { field: 'tag', matchedLine: `tag ${tag}` };
  if (has(recipe.source)) return { field: 'source', matchedLine: `source: ${recipe.source}` };
  const label = categoryOf(recipe)?.label;
  if (has(label)) return { field: 'category', matchedLine: `category: ${label}` };
  return null;
}

export function recipeMatchesQuery(recipe, query, mode = SEARCH_MODES.ALL) {
  return matchRecipe(recipe, query, mode) !== null;
}

/**
 * @returns {{ recipe: object, field: string, matchedLine?: string }[]} the
 *   matching rows with why each matched, in the order given; [] for a blank query
 */
export function searchMatches(rows, query, mode = SEARCH_MODES.ALL) {
  if (!normaliseText(query).trim()) return [];
  const out = [];
  for (const recipe of rows) {
    if (isComingSoon(recipe)) continue;
    const hit = matchRecipe(recipe, query, mode);
    if (hit) out.push({ recipe, ...hit });
  }
  return out;
}

/** @returns {object[]} the matching rows, in the order given; [] for a blank query */
export function searchCatalog(rows, query, mode = SEARCH_MODES.ALL) {
  return searchMatches(rows, query, mode).map((m) => m.recipe);
}
