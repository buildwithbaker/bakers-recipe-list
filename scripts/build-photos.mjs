// Makes the photo sizes the app shows, from the originals in src/photos/.
//
// Runs before `vite build` (prebuild) and `vite` (predev). For each
// src/photos/<segment>.jpg|png|webp it writes, into src/photos/generated/
// (gitignored):
//   <segment>-thumb.webp   240x240, cropped to fill: the card slot
//   <segment>-large.webp   800px wide: the recipe header photo
// src/utils/recipePhoto.js finds them with import.meta.glob, so there is no
// manifest to keep in step and no recipes.json edit.
//
// Fails the build, loudly, on a file that matches no recipe, is too big or is
// not a photo. A photo silently dropped is worse than a build that stops.
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { expandVersionedRecipe } from '../src/data/expandVersions.js';
import { PHOTO_SIZES, generatedName, planPhotos } from '../src/utils/photoFiles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src', 'photos');
const OUT = join(SRC, 'generated');

const recipes = JSON.parse(readFileSync(join(root, 'src', 'data', 'recipes.json'), 'utf8'));
const knownIds = new Set(recipes.flatMap((r) => expandVersionedRecipe(r).map((row) => row.id)));

const files = existsSync(SRC)
  ? readdirSync(SRC).map((name) => ({ name, bytes: statSync(join(SRC, name)).size }))
  : [];
const { photos, errors } = planPhotos(files, knownIds);

if (errors.length) {
  console.error(`✗ src/photos/ has ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

// Outputs whose source is gone are removed, so a deleted photo disappears.
const wanted = new Set(photos.flatMap((p) => Object.keys(PHOTO_SIZES).map((s) => generatedName(p.segment, s))));
for (const name of readdirSync(OUT)) if (!wanted.has(name)) unlinkSync(join(OUT, name));

let made = 0;
for (const p of photos) {
  const src = join(SRC, p.file);
  const srcTime = statSync(src).mtimeMs;
  for (const [size, opts] of Object.entries(PHOTO_SIZES)) {
    const out = join(OUT, generatedName(p.segment, size));
    if (existsSync(out) && statSync(out).mtimeMs >= srcTime) continue; // up to date
    await sharp(src).rotate().resize(opts).webp({ quality: size === 'thumb' ? 72 : 78 }).toFile(out);
    made += 1;
  }
}
console.log(`✓ photos - ${photos.length} in src/photos/, ${made} size${made === 1 ? '' : 's'} written to src/photos/generated/`);
