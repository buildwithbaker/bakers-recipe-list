// Rasterizes every public/diagrams/*.svg to a PNG companion beside it
// (<name>.svg -> <name>.png), about 1200 px wide, flattened onto the recipe
// card's cream (#fffbf5). The downloadable card embeds the PNG; it never
// parses SVG.
//
// Run by hand when a diagram is added or changed, then commit the PNG:
//   node scripts/rasterize-diagrams.mjs
// Deliberately NOT an npm script and NOT part of prebuild: a build must never
// rewrite committed files. validate-recipes.mjs fails if the PNG is missing.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'diagrams');
const TARGET_WIDTH = 1200;
const CREAM = '#fffbf5';

for (const name of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
  const svg = readFileSync(join(dir, name));
  // SVG renders at 72 dpi; scale the density so the width lands on the target.
  const { width } = await sharp(svg).metadata();
  const density = Math.ceil((72 * TARGET_WIDTH) / width);
  const png = await sharp(svg, { density })
    .resize({ width: TARGET_WIDTH })
    .flatten({ background: CREAM })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const out = name.replace(/\.svg$/, '.png');
  writeFileSync(join(dir, out), png);
  console.log(`${name} -> ${out} (${Math.round(png.length / 1024)} KB)`);
}
