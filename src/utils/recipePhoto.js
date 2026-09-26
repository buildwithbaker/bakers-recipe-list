// Where a recipe's photo lives, if it has one.
//
// Every caller (card thumbnail, recipe header) asks here and nowhere else.
// Photos come from the drop folder src/photos/, sized by
// scripts/build-photos.mjs into src/photos/generated/ and found here by name.
// Vite fingerprints and bundles the files, so a changed photo busts the cache.
//
// The older optional `image` field (a path under public/) still works as a
// fallback, so nothing that used it breaks.
import { BASE_PATH } from './recipeRoute.js';
import { idToSlug } from './recipeSlug.js';

const glob = (files) => {
  const bySegment = new Map();
  for (const [path, url] of Object.entries(files)) {
    const m = path.match(/\/([^/]+)-(thumb|large)\.webp$/);
    if (m) bySegment.set(m[1], url);
  }
  return bySegment;
};

const THUMBS = glob(import.meta.glob('../photos/generated/*-thumb.webp', { eager: true, query: '?url', import: 'default' }));
const LARGES = glob(import.meta.glob('../photos/generated/*-large.webp', { eager: true, query: '?url', import: 'default' }));

/** @returns {{ thumb: string, large: string } | null} */
export function recipePhoto(recipe) {
  if (!recipe?.id) return null;
  const segment = idToSlug(recipe.id);
  if (THUMBS.has(segment) && LARGES.has(segment)) {
    return { thumb: THUMBS.get(segment), large: LARGES.get(segment) };
  }
  if (recipe.image) {
    const url = `${BASE_PATH}${String(recipe.image).replace(/^\/+/, '')}`;
    return { thumb: url, large: url };
  }
  return null;
}

// The letter shown in an empty photo slot: the first A-Z character of the name.
export function photoInitial(name) {
  return (String(name ?? '').match(/[A-Za-z]/) || ['·'])[0].toUpperCase();
}
