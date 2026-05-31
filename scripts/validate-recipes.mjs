// Build-time integrity guard for src/data/recipes.json.
// Runs as the npm `prebuild` hook, so `npm run build` (local + CI/Pages) fails
// fast if the data regresses. `recipe.name` is the canonical key everywhere
// (madeSet/pinnedSet, cook log, recipesByName, key={recipe.name}, ?recipe=<name>
// deep links), so duplicate names corrupt state and lookups — guard them here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SECTIONS } from '../src/data/sections.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipes = JSON.parse(readFileSync(join(root, 'src/data/recipes.json'), 'utf8'));

const errors = [];

// 1. Every recipe must have a non-empty string name.
recipes.forEach((r, i) => {
  if (typeof r.name !== 'string' || r.name.trim() === '') {
    errors.push(`record #${i} has a missing or empty name`);
  }
});

// 2. Names must be globally unique (the canonical key).
const seen = new Map();
recipes.forEach((r) => {
  seen.set(r.name, (seen.get(r.name) || 0) + 1);
});
const dups = [...seen.entries()].filter(([, c]) => c > 1);
if (dups.length) {
  errors.push(
    `${dups.length} duplicate recipe name(s): ` +
      dups.map(([n, c]) => `"${n}" (×${c})`).join(', '),
  );
}

// 3. Every recipe.section must map to a known SECTIONS key.
const validSections = new Set(SECTIONS.map((s) => s.key));
const badSections = [...new Set(recipes.map((r) => r.section))].filter(
  (s) => !validSections.has(s),
);
if (badSections.length) {
  errors.push(`unknown section(s): ${badSections.map((s) => `"${s}"`).join(', ')}`);
}

if (errors.length) {
  console.error('✗ recipes.json failed validation:');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

console.log(`✓ recipes.json OK — ${recipes.length} records, ${seen.size} unique names`);
