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
import idManifest from './recipes.ids.json';
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

// id→recipe, over DISPLAY rows, so an expanded child resolves by its derived
// `${parent}::v{n}` id and an unexpanded record by its own. This is the primary
// lookup: `id` is what state keys and `?recipe=` links carry.
export const recipesById = new Map(displayRecipes.map((r) => [r.id, r]));

// Name→recipe: the ALIAS LAYER. Names stay resolvable forever, so no link or
// stored entry ever dies, but they are no longer the identity.
//
// Seeded in ASCENDING precedence — each pass overwrites the last, so the
// listed-first source wins:
//   3. legacy names from the frozen manifest (what a pre-migration link held)
//   2. raw pre-expansion names from recipes.json
//   1. display names — canonical, written last, win every tie
export const recipesByName = (() => {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const map = new Map();
  for (const [id, legacyName] of Object.entries(idManifest.ids)) {
    const record = byId.get(id);
    if (record) map.set(legacyName, record);
  }
  for (const r of recipes) map.set(r.name, r);
  for (const r of displayRecipes) map.set(r.name, r);
  return map;
})();

// The one resolution entry point: id first, then any name alias. Everything
// that turns a stored string back into a recipe goes through this.
export function resolveRecipe(key) {
  if (!key) return null;
  return recipesById.get(key) ?? recipesByName.get(key) ?? null;
}
