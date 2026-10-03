// The canonical recipe lists and id/name→recipe lookups, built once at module load.
//
// `id` is the identity: it keys the made/pinned Sets, the cook log, the
// shopping list, Recently Viewed, `?recipe=` deep links and the /r/<slug>/
// path. `name` is an alias layer kept resolvable so no old link or stored entry
// dies (architecture.md section 4).
//
// Every record renders as exactly one row. Until 2026-10-02, For Review records
// were expanded into one row per version (`<id>::vN`); that collection was
// removed, and a removed record's `<id>::vN` keys now resolve through the
// `removed` map below like any other removed key.
import recipes from './recipes.json';
import idManifest from './recipes.ids.json';

// Raw records, in file order. Use this only when you genuinely mean the stored
// catalog (validation, counts); anything the user can click wants `displayRecipes`.
export { recipes as rawRecipes };

// Every row the app renders, in file order: one per record.
export const displayRecipes = recipes;

// Display rows grouped by section key, preserving file order within a section.
export const displayedBySection = (() => {
  const map = new Map();
  for (const recipe of displayRecipes) {
    if (!map.has(recipe.section)) map.set(recipe.section, []);
    map.get(recipe.section).push(recipe);
  }
  return map;
})();

// id→recipe. The primary lookup: `id` is what state keys and links carry.
export const recipesById = new Map(displayRecipes.map((r) => [r.id, r]));

// Name→recipe: the ALIAS LAYER. Names stay resolvable forever, so no link or
// stored entry ever dies, but they are no longer the identity.
//
// Seeded in ASCENDING precedence — each pass overwrites the last, so the
// listed-first source wins:
//   2. legacy names from the frozen manifest (what a pre-migration link held)
//   1. current names — canonical, written last, win every tie
export const recipesByName = (() => {
  const map = new Map();
  for (const [id, legacyName] of Object.entries(idManifest.ids)) {
    const record = recipesById.get(id);
    if (record) map.set(legacyName, record);
  }
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

// The display row a record id lands on.
export function successorRow(to, rowsById) {
  if (!to) return null;
  return rowsById.get(to) ?? null;
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
