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
import { expandVersionedRecipe, legacyRowNames } from './expandVersions.js';

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

// Old display name -> child id, for every expanded row renamed by the
// 2026-09-27 display rule (expandVersions.js, legacyShortenName). Generated
// from the frozen old rule, never by hand. Old `?recipe=` links and
// pre-migration saved state carry these names, so they stay resolvable at the
// LOWEST precedence. Two rows claiming one old name is a data error: the
// first keeps it and the clash is listed in legacyDisplayAliasCollisions,
// which recipes.integrity.test.js requires to be empty.
export const legacyDisplayAliasCollisions = [];
export const legacyDisplayAliases = (() => {
  const map = new Map();
  for (const recipe of recipes) {
    if (!REVIEW_SECTION_KEYS.has(recipe.section)) continue;
    for (const { name, id } of legacyRowNames(recipe)) {
      if (map.has(name) && map.get(name) !== id) {
        legacyDisplayAliasCollisions.push(`"${name}" -> ${map.get(name)} and ${id}`);
        continue;
      }
      map.set(name, id);
    }
  }
  return map;
})();

// Name→recipe: the ALIAS LAYER. Names stay resolvable forever, so no link or
// stored entry ever dies, but they are no longer the identity.
//
// Seeded in ASCENDING precedence — each pass overwrites the last, so the
// listed-first source wins:
//   4. old display names (legacyDisplayAliases) - lowest, lose every tie
//   3. legacy names from the frozen manifest (what a pre-migration link held)
//   2. raw pre-expansion names from recipes.json
//   1. display names — canonical, written last, win every tie
export const recipesByName = (() => {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const map = new Map();
  for (const [legacyName, id] of legacyDisplayAliases) {
    const row = recipesById.get(id);
    if (row) map.set(legacyName, row);
  }
  for (const [id, legacyName] of Object.entries(idManifest.ids)) {
    const record = byId.get(id);
    if (record) map.set(legacyName, record);
  }
  for (const r of recipes) map.set(r.name, r);
  for (const r of displayRecipes) map.set(r.name, r);
  return map;
})();

// ---------------------------------------------------------------------------
// Removed records (recipes.ids.json `removed`).
//
// A removed id keeps its frozen `ids` entry and gains { to, note, versions? }.
// Everything a user could still hold for it - the id, a `<id>::vN` child id if
// it was a versioned record, or its legacy manifest name - resolves to the
// successor's display row. `to: null` resolves to null, the normal not-found
// path. Pure over its inputs so tests can drive it with a fixture manifest.
// ---------------------------------------------------------------------------

// The display row a record id lands on. An expanded (versioned) record has no
// row under its own id, only `<id>::v1..N`, so it lands on its first version.
export function successorRow(to, rowsById) {
  if (!to) return null;
  return rowsById.get(to) ?? rowsById.get(`${to}::v1`) ?? null;
}

// The removed id a stored key names, or null. Matches the id itself and any
// `<id>::vN` child id it had while it was a versioned record.
export function removedIdForKey(key, removed) {
  if (typeof key !== 'string' || !removed) return null;
  if (Object.hasOwn(removed, key)) return key;
  const child = /^(.+)::v\d+$/.exec(key);
  return child && Object.hasOwn(removed, child[1]) ? child[1] : null;
}

// Builds the two removed-key lookups. Each returns `undefined` when the key is
// not a removed key at all (so the caller carries on), else the successor row
// or null.
export function createRemovedLookup(manifest, rowsById) {
  const removed = manifest?.removed ?? {};
  const byLegacyName = new Map();
  for (const id of Object.keys(removed)) {
    const legacy = manifest?.ids?.[id];
    if (legacy) byLegacyName.set(legacy, id);
  }
  const land = (id) => successorRow(removed[id]?.to ?? null, rowsById);
  return {
    byId(key) {
      const id = removedIdForKey(key, removed);
      return id === null ? undefined : land(id);
    },
    byName(key) {
      return byLegacyName.has(key) ? land(byLegacyName.get(key)) : undefined;
    },
  };
}

const removedLookup = createRemovedLookup(idManifest, recipesById);

// The successor display-row id for a stored key that names a removed record,
// or null when the key is not removed or its successor is null. Used by the
// state rekey pass in stateMigration.js.
export function removedSuccessorId(key, manifest = idManifest, rowsById = recipesById) {
  const lookup = manifest === idManifest && rowsById === recipesById
    ? removedLookup
    : createRemovedLookup(manifest, rowsById);
  const hit = lookup.byId(key) ?? lookup.byName(key);
  return hit ? hit.id : null;
}

// The one resolution entry point: id first, then a removed id, then any name
// alias, then a removed record's legacy name (a live name always wins that
// tie). Everything that turns a stored string back into a recipe goes through
// this.
export function resolveRecipe(key) {
  if (!key) return null;
  const live = recipesById.get(key);
  if (live) return live;
  const removedHit = removedLookup.byId(key);
  if (removedHit !== undefined) return removedHit;
  return recipesByName.get(key) ?? removedLookup.byName(key) ?? null;
}
