// The rules for the photo drop folder, src/photos/.
//
// Drop a photo named after the recipe's URL segment (for a normal recipe that
// is its id: lasagna.jpg; for a version row, chili--v2.jpg). The build
// (scripts/build-photos.mjs) makes the sizes the app shows; nothing in
// recipes.json changes. Kept free of Node APIs so the rules are unit-tested.
import { idToSlug } from './recipeSlug.js';

export const PHOTO_SOURCE_EXT = /\.(jpe?g|png|webp)$/i;

// 2 MB per original (Adam, 2026-09-26: raised from the old 500 KB so most
// photos can be dropped in without resizing). The original never ships - only
// the sized copies do - so this bounds the REPO, not the site: git keeps every
// version of a committed file forever. At one photo per recipe that is up to
// ~320 MB of history, accepted. See docs/internal/adding-a-photo.md.
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;

// Output sizes. thumb: the 88px card slot at up to 2.7x density. large: the
// recipe header photo (240px box) and a full-width phone header at 2x.
export const PHOTO_SIZES = {
  thumb: { width: 240, height: 240, fit: 'cover' },
  large: { width: 800, fit: 'inside' },
};

export const generatedName = (segment, size) => `${segment}-${size}.webp`;

/**
 * Checks the drop folder against the catalogue.
 * @param files     [{ name, bytes }] in src/photos/
 * @param knownIds  Set of display-row ids
 * @returns {{ photos: {segment, id, file}[], errors: string[] }}
 */
export function planPhotos(files, knownIds) {
  const photos = [];
  const errors = [];
  const seen = new Map();
  // Segment -> id, built from the real ids, so a file can only ever match an
  // id that exists; nothing here turns a file name into a new id.
  const idBySegment = new Map([...knownIds].map((id) => [idToSlug(id), id]));
  for (const { name, bytes } of files) {
    if (name.startsWith('.') || name === 'generated' || /\.md$/i.test(name)) continue;
    if (!PHOTO_SOURCE_EXT.test(name)) {
      errors.push(`src/photos/${name}: not a photo. Use .jpg, .png or .webp (export HEIC from Photos as JPEG first).`);
      continue;
    }
    const segment = name.replace(PHOTO_SOURCE_EXT, '');
    const id = idBySegment.get(segment);
    if (!id) {
      errors.push(`src/photos/${name}: no recipe has the address /r/${segment}/. Name the file after the recipe's id, as in its /r/<id>/ address.`);
      continue;
    }
    if (bytes > MAX_SOURCE_BYTES) {
      errors.push(`src/photos/${name}: ${mb(bytes)}, over the ${mb(MAX_SOURCE_BYTES)} limit. Resize to about 1600px wide, JPEG quality 80.`);
      continue;
    }
    if (seen.has(segment)) {
      errors.push(`src/photos/${name}: "${seen.get(segment)}" is already the photo for ${id}. Keep one.`);
      continue;
    }
    seen.set(segment, name);
    photos.push({ segment, id, file: name });
  }
  return { photos, errors };
}
