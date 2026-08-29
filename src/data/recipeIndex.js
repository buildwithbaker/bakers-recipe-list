// The canonical recipe lists and name→recipe lookup, built once at module load.
//
// `recipe.name` is the app's primary key: it is what the made/pinned Sets, the
// cook log, the shopping list, `?recipe=` deep links and Recently Viewed all
// store. Recipes in a `review: true` section are RENAMED at display time by
// `expandVersionedRecipe` (multi-version rows become "X (Version 1)", and the
// redundant "— Chicken Marinade" suffix is stripped), so the names the UI hands
// out are not the names in recipes.json.
//
// Everything therefore resolves against ONE list — `displayRecipes` — instead of
// each consumer re-deriving its own. When the list and the lookup were built
// from different sources, every expanded row was unopenable: the row emitted a
// display name that the raw-name lookup could not find, and the card silently
// rendered nothing.
import recipes from './recipes.json';
import { SECTIONS } from './sections.js';
import { expandVersionedRecipe } from './expandVersions.js';

const REVIEW_SECTION_KEYS = new Set(
  SECTIONS.filter((s) => s.review).map((s) => s.key),
);

// Raw records, in file order. Use this only when you genuinely mean the stored
// catalog (validation, counts); anything the user can click wants `displayRecipes`.
export { recipes as rawRecipes };

// Every row the app renders, in file order. Review-section records are expanded
// into one entry per version; everything else passes through untouched.
export const displayRecipes = recipes.flatMap((recipe) =>
  REVIEW_SECTION_KEYS.has(recipe.section) ? expandVersionedRecipe(recipe) : [recipe],
);

// Display rows grouped by section key, preserving file order within a section.
export const displayedBySection = (() => {
  const map = new Map();
  for (const recipe of displayRecipes) {
    if (!map.has(recipe.section)) map.set(recipe.section, []);
    map.get(recipe.section).push(recipe);
  }
  return map;
})();

// Name→recipe resolution. Display names are canonical and are written last, so
// they win any tie. The pre-expansion names are seeded first as fallback
// aliases, which keeps `?recipe=Tandoori%20-%20Chicken%20Marinade` links and
// Recently Viewed entries saved before the expansion existed resolving.
export const recipesByName = new Map([
  ...recipes.map((r) => [r.name, r]),
  ...displayRecipes.map((r) => [r.name, r]),
]);
