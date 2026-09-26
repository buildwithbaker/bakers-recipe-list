// Search: one query across all three collections.
//
// A row matches when the query appears in its name, any ingredient line, any
// tag (manual or auto-derived), its source, or its category label. Matching is
// case- and accent-insensitive, so "jalapeno" finds "jalapeño".
//
// Coming-soon placeholders are left out: they have no page and no ingredients,
// so a result that opens onto "coming soon" answers nothing.
import { getEffectiveTags } from './autoTags.js';
import { isComingSoon } from './recipeKinds.js';
import { categoryOf, collectionOf, COLL_BOOK, COLL_REVIEW, COLL_TRY } from '../data/catalog.js';

export function normaliseText(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function recipeMatchesQuery(recipe, query) {
  const q = normaliseText(query).trim();
  if (!q) return true;
  const has = (s) => normaliseText(s).includes(q);
  if (has(recipe.name)) return true;
  if (recipe.ingredients?.some((ing) => has(ing.text))) return true;
  if (getEffectiveTags(recipe).some(has)) return true;
  if (has(recipe.source)) return true;
  if (has(categoryOf(recipe)?.label)) return true;
  return false;
}

/**
 * @returns {{ book: object[], review: object[], try: object[], total: number }}
 */
export function searchCatalog(rows, query) {
  const out = { [COLL_BOOK]: [], [COLL_REVIEW]: [], [COLL_TRY]: [], total: 0 };
  if (!normaliseText(query).trim()) return out;
  for (const r of rows) {
    if (isComingSoon(r)) continue;
    if (!recipeMatchesQuery(r, query)) continue;
    out[collectionOf(r)].push(r);
    out.total += 1;
  }
  return out;
}
