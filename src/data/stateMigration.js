// One-time migration of persisted state from name keys to id keys.
//
// Every store below was keyed by `recipe.name`, which is a display string: it
// changes when a recipe is renamed, and it renumbers when a versioned record
// gains a sibling. `id` is frozen, so this is the last time these keys move.
//
// Order is load-bearing (see migrateState): build and check the map, transform
// ALL stores in memory, write them, set the flag LAST. A crash or a quota
// exception anywhere before the flag leaves the flag unset and every store on
// its previous value, so the next run simply starts over.
//
// A name that resolves to no id is PRESERVED UNTOUCHED. It is a recipe that was
// deleted or renamed out from under the user; dropping it would silently
// destroy their notes.
import idManifest from './recipes.ids.json';
import { displayRecipes, recipesById, removedSuccessorId } from './recipeIndex.js';

export const STATE_VERSION_KEY = 'brl_state_version';
export const TARGET_VERSION = 2;

export const STORES = {
  made: 'brl_made_v1',
  pinned: 'brl_pinned_v1',
  cookLog: 'brl_cook_log',
  recent: 'brl_recently_viewed',
  shopping: 'brl_shopping_list',
};

/**
 * name → id, built ONCE per migration run.
 *
 * Sources, ascending precedence: the frozen manifest's legacy names (what the
 * stored keys actually are), then raw/display names for anything renamed since.
 *
 * Throws if it is not injective. Two records sharing a name would collapse two
 * users' worth of state onto one id, and silently — better to abort and leave
 * every store untouched.
 */
export function buildNameToId(records = displayRecipes, manifest = idManifest) {
  const pairs = [];
  const byId = new Map(records.map((r) => [r.id, r]));
  for (const [id, legacyName] of Object.entries(manifest.ids ?? {})) {
    if (byId.has(id)) pairs.push([legacyName, id]);
  }
  for (const r of records) pairs.push([r.name, r.id]);

  const map = new Map();
  const conflicts = [];
  for (const [name, id] of pairs) {
    const existing = map.get(name);
    if (existing !== undefined && existing !== id) conflicts.push(`"${name}" -> ${existing} and ${id}`);
    map.set(name, id);
  }
  if (conflicts.length) {
    throw new Error(
      `name→id map is not injective (${conflicts.length}): ${conflicts.slice(0, 5).join('; ')}`,
    );
  }
  return map;
}

// Unmapped names are returned as-is, never dropped.
const toId = (map, name) => map.get(name) ?? name;

// --- per-store transforms (pure) --------------------------------------------

export function migrateNameArray(value, map) {
  if (!Array.isArray(value)) return value;
  const seen = new Set();
  const out = [];
  for (const name of value) {
    const id = toId(map, name);
    if (seen.has(id)) continue;   // two old names can fold onto one id
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function migrateCookLog(value, map) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  for (const [name, entry] of Object.entries(value)) {
    const id = toId(map, name);
    const prev = out[id];
    if (!prev) { out[id] = entry; continue; }
    // Collision (two old names, one id): union the dates, keep both notes.
    out[id] = {
      ...prev,
      dates: [...(prev.dates ?? []), ...(entry?.dates ?? [])],
      notes: [prev.notes, entry?.notes].filter(Boolean).join('\n\n'),
    };
  }
  return out;
}

export function migrateRecentlyViewed(value, map) {
  if (!Array.isArray(value)) return value;
  const seen = new Set();
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const id = toId(map, item.name);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...item, id });   // `name` is kept: it is the label if the id ever dies
  }
  return out;
}

export function migrateShoppingList(value, map) {
  if (!Array.isArray(value)) return value;
  return value.map((item) =>
    item && typeof item === 'object' ? { ...item, recipe: toId(map, item.recipe) } : item,
  );
}

const TRANSFORMS = [
  [STORES.made, migrateNameArray],
  [STORES.pinned, migrateNameArray],
  [STORES.cookLog, migrateCookLog],
  [STORES.recent, migrateRecentlyViewed],
  [STORES.shopping, migrateShoppingList],
];

/**
 * Runs the migration. Safe to call on every boot: it no-ops once the flag is at
 * TARGET_VERSION. Never throws out to the caller for storage reasons — a failed
 * migration must not white-screen the app, it just retries next boot.
 *
 * @returns {{status: string, migrated?: string[], reason?: string}}
 */
export function migrateState({ storage = globalThis.localStorage, records, manifest } = {}) {
  if (!storage) return { status: 'skipped', reason: 'no storage' };

  try {
    if (Number(storage.getItem(STATE_VERSION_KEY)) >= TARGET_VERSION) {
      return { status: 'already-current' };
    }
  } catch {
    return { status: 'skipped', reason: 'storage unreadable' };
  }

  let map;
  try {
    map = buildNameToId(records, manifest);
  } catch (err) {
    // Non-injective map: abort loudly, write nothing, leave the flag unset.
    return { status: 'aborted', reason: err.message };
  }

  // 1. Transform every store in memory first. An absent store is skipped, not
  //    an error; unparseable JSON is left exactly as it is.
  const pending = [];
  for (const [key, transform] of TRANSFORMS) {
    let raw;
    try { raw = storage.getItem(key); } catch { return { status: 'aborted', reason: `unreadable ${key}` }; }
    if (raw === null || raw === undefined) continue;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const next = JSON.stringify(transform(parsed, map));
    if (next !== raw) pending.push([key, next]);
  }

  // 2. Only now write. If one throws (quota), the flag below is never reached,
  //    so the next boot re-runs from the original names. The transforms are
  //    name→id lookups with pass-through for unknown keys, so a store that did
  //    get written is a no-op on the retry.
  try {
    for (const [key, value] of pending) storage.setItem(key, value);
  } catch (err) {
    return { status: 'failed', reason: String(err && err.message ? err.message : err) };
  }

  // 3. Flag LAST.
  try {
    storage.setItem(STATE_VERSION_KEY, String(TARGET_VERSION));
  } catch (err) {
    return { status: 'failed', reason: `flag: ${String(err && err.message ? err.message : err)}` };
  }

  return { status: 'migrated', migrated: pending.map(([k]) => k) };
}

// ---------------------------------------------------------------------------
// Removed-record rekey (recipes.ids.json `removed`).
//
// The components read state by `recipe.id` directly (madeSet.has(recipe.id),
// cookLog[recipe.id]), so a key saved under a removed id would never show on
// its successor. This pass moves every such key - the removed id, a
// `<removed>::vN` child id, or its legacy manifest name - to the successor's
// display-row id, MERGING with whatever the successor already holds. A removed
// id with `to: null` is left untouched: it resolves to nothing and shows
// nowhere, and dropping it would destroy notes for no gain.
//
// Not flag-gated like migrateState: it is idempotent by construction (after
// one run no removed key remains, so a second run finds nothing to move), and
// a new removal in a later deploy has to be picked up by users who already
// ran it. A no-op, with no reads, while `removed` is empty.
// ---------------------------------------------------------------------------

export function rekeyNameArray(value, toSuccessor) {
  if (!Array.isArray(value)) return value;
  const seen = new Set();
  const out = [];
  for (const key of value) {
    const id = toSuccessor(key) ?? key;
    if (seen.has(id)) continue;   // union: the successor may already be in the set
    seen.add(id);
    out.push(id);
  }
  return out;
}

const byDate = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function rekeyCookLog(value, toSuccessor) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  // Live keys first, so a merged entry keeps the successor's own notes first.
  const entries = Object.entries(value).sort(
    ([a], [b]) => Number(toSuccessor(a) !== null) - Number(toSuccessor(b) !== null),
  );
  for (const [key, entry] of entries) {
    const successor = toSuccessor(key);
    const id = successor ?? key;
    const prev = out[id];
    if (!prev) {
      out[id] = successor && entry && Array.isArray(entry.dates)
        ? { ...entry, dates: [...entry.dates].sort(byDate) }
        : entry;
      continue;
    }
    out[id] = {
      ...prev,
      dates: [...(prev.dates ?? []), ...(entry?.dates ?? [])].sort(byDate),
      notes: [prev.notes, entry?.notes].filter(Boolean).join('\n\n'),
    };
  }
  // Keep the stored key order stable for keys that did not move, so an
  // untouched log serialises byte-identically and is not rewritten.
  const ordered = {};
  for (const key of Object.keys(value)) {
    const id = toSuccessor(key) ?? key;
    if (id in out && !(id in ordered)) ordered[id] = out[id];
  }
  return ordered;
}

export function rekeyRecentlyViewed(value, toSuccessor) {
  if (!Array.isArray(value)) return value;
  const moved = value.map((item) =>
    item && typeof item === 'object' ? toSuccessor(item.id ?? item.name) : null,
  );
  // Only ids a move landed on can now appear twice; dedupe those alone, keeping
  // the most recent (first) occurrence. Every other entry passes through as-is.
  const targets = new Set(moved.filter(Boolean));
  const seen = new Set();
  const out = [];
  value.forEach((item, i) => {
    const next = moved[i] ? { ...item, id: moved[i] } : item;
    const id = next && typeof next === 'object' ? next.id : undefined;
    if (id && targets.has(id)) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(next);
  });
  return out;
}

export function rekeyShoppingList(value, toSuccessor) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const successor = toSuccessor(item.recipe);
    return successor ? { ...item, recipe: successor } : item;
  });
}

const REKEYS = [
  [STORES.made, rekeyNameArray],
  [STORES.pinned, rekeyNameArray],
  [STORES.cookLog, rekeyCookLog],
  [STORES.recent, rekeyRecentlyViewed],
  [STORES.shopping, rekeyShoppingList],
];

/**
 * Moves saved state off removed ids onto their successors. Safe on every boot;
 * never throws out to the caller.
 *
 * @returns {{status: string, rekeyed?: string[], reason?: string}}
 */
export function rekeyRemovedState({
  storage = globalThis.localStorage,
  manifest = idManifest,
  rowsById = recipesById,
} = {}) {
  if (!storage) return { status: 'skipped', reason: 'no storage' };
  if (!manifest?.removed || Object.keys(manifest.removed).length === 0) {
    return { status: 'nothing-removed' };
  }
  const toSuccessor = (key) =>
    typeof key === 'string' ? removedSuccessorId(key, manifest, rowsById) : null;

  // Same order as migrateState: transform everything in memory, then write.
  const pending = [];
  for (const [key, transform] of REKEYS) {
    let raw;
    try { raw = storage.getItem(key); } catch { return { status: 'aborted', reason: `unreadable ${key}` }; }
    if (raw === null || raw === undefined) continue;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const next = JSON.stringify(transform(parsed, toSuccessor));
    if (next !== raw) pending.push([key, next]);
  }
  try {
    for (const [key, value] of pending) storage.setItem(key, value);
  } catch (err) {
    return { status: 'failed', reason: String(err && err.message ? err.message : err) };
  }
  return { status: pending.length ? 'rekeyed' : 'already-current', rekeyed: pending.map(([k]) => k) };
}
