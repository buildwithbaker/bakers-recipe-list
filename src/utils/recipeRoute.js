// The app's URL contract: which recipe a path names, and what path a recipe gets.
//
// The path is the SOURCE OF TRUTH for the open recipe. `?recipe=` used to carry
// it, but a query string cannot be prerendered to a file, and a crawler that
// never runs JavaScript only ever sees the bytes on disk. scripts/prerender.mjs
// writes dist/r/<slug>/index.html per recipe, so the app has to read the same
// shape back. src/utils/recipeSlug.js owns the id <-> slug half of it.
//
// `?recipe=` keeps working forever - App.jsx resolves it on load and rewrites
// the entry to the equivalent path.
import { idToSlug, slugToId } from './recipeSlug.js';

// '/bakers-recipe-list/' in both dev and prod - Vite serves `base` in dev too.
export const BASE_PATH = import.meta.env.BASE_URL || '/';

const withTrailingSlash = (p) => (p.endsWith('/') ? p : `${p}/`);

export function recipePath(id, base = BASE_PATH) {
  return `${withTrailingSlash(base)}r/${idToSlug(id)}/`;
}

// The recipe key a pathname names, or '' when the path is the list (or anything
// else). The caller still has to resolve the key - an unknown slug returns a
// key that resolveRecipe rejects, which is what keeps a stale link on the list
// instead of 404ing it.
export function recipeKeyFromPath(pathname, base = BASE_PATH) {
  const raw = String(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  let path = raw;
  // A slug is [a-z0-9-] so nothing here needs decoding; a malformed % would
  // throw, and a throw on first paint would take the whole app down.
  try { path = decodeURIComponent(raw); } catch { /* use the raw path */ }
  const prefix = withTrailingSlash(base);
  if (!path.startsWith(prefix)) return '';
  const match = /^r\/([^/]+)\/?$/.exec(path.slice(prefix.length));
  return match ? slugToId(match[1]) : '';
}
