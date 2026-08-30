// Build-time integrity guard for src/data/recipes.json.
// Runs as the npm `prebuild` hook, so `npm run build` (local + CI/Pages) fails
// fast if the data regresses.
//
// The contract lives in src/data/recipe.schema.json — this script ENFORCES that
// schema (it is not a second source of truth). Rules are read from the schema at
// runtime, so editing the schema changes what is enforced. `recipe.name` is the
// canonical key everywhere (madeSet/pinnedSet, cook log, recipesByName,
// key={recipe.name}, ?recipe=<name> deep links), so duplicate names corrupt
// state and lookups — guarded here.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SECTIONS } from '../src/data/sections.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'src/data/recipe.schema.json'), 'utf8'));
const recipes = JSON.parse(readFileSync(join(root, 'src/data/recipes.json'), 'utf8'));
const idManifest = JSON.parse(readFileSync(join(root, 'src/data/recipes.ids.json'), 'utf8'));

const errors = [];
const props = schema.properties;
const required = schema.required;
const sectionEnum = props.section.enum;
const categoryEnum = props.category.enum;
const ingTypeEnum = props.ingredients.items.properties.type.enum;
const tagPattern = new RegExp(props.tags.items.pattern);
const instrKeys = Object.keys(props.instructions.items.properties);
const idPattern = new RegExp(props.id.pattern);

// 0. recipes.json must be an array.
if (!Array.isArray(recipes)) {
  console.error('✗ recipes.json must be a top-level array');
  process.exit(1);
}

// 1. Drift guard: schema section enum must match the keys in sections.js exactly.
const secKeys = SECTIONS.map((s) => s.key).slice().sort();
const schemaSecs = sectionEnum.slice().sort();
if (JSON.stringify(secKeys) !== JSON.stringify(schemaSecs)) {
  errors.push(
    'recipe.schema.json `section.enum` is out of sync with src/data/sections.js SECTIONS keys ' +
      '(update both together)',
  );
}

const seen = new Map();
const seenIds = new Map();

recipes.forEach((r, i) => {
  const where = `record #${i}${r && typeof r.name === 'string' ? ` ("${r.name}")` : ''}`;
  if (r === null || typeof r !== 'object' || Array.isArray(r)) {
    errors.push(`${where} is not an object`);
    return;
  }

  // required fields present + no unknown fields (additionalProperties:false)
  required.forEach((k) => {
    if (!(k in r)) errors.push(`${where} is missing required field "${k}"`);
  });
  Object.keys(r).forEach((k) => {
    if (!(k in props)) errors.push(`${where} has unknown field "${k}"`);
  });

  // id — frozen identity. Never recomputed from the name; see recipe.schema.json.
  if (typeof r.id !== 'string' || !idPattern.test(r.id)) {
    errors.push(`${where} id must be a string matching ${props.id.pattern}`);
  } else {
    seenIds.set(r.id, (seenIds.get(r.id) || 0) + 1);
  }

  // name (canonical key)
  if (typeof r.name !== 'string' || r.name.trim() === '') {
    errors.push(`${where} name must be a non-empty string`);
  } else {
    seen.set(r.name, (seen.get(r.name) || 0) + 1);
  }

  // section / category enums
  if (!sectionEnum.includes(r.section)) errors.push(`${where} has invalid section "${r.section}"`);
  if (!categoryEnum.includes(r.category)) errors.push(`${where} has invalid category "${r.category}"`);

  // source
  if (typeof r.source !== 'string' || r.source.trim() === '') {
    errors.push(`${where} source must be a non-empty string`);
  }

  // is_blank
  if (typeof r.is_blank !== 'boolean') errors.push(`${where} is_blank must be a boolean`);

  // tags
  if (!Array.isArray(r.tags)) {
    errors.push(`${where} tags must be an array`);
  } else {
    r.tags.forEach((t) => {
      if (typeof t !== 'string' || !tagPattern.test(t)) {
        errors.push(`${where} has invalid tag ${JSON.stringify(t)} (must match ${props.tags.items.pattern})`);
      }
    });
  }

  // ingredients
  if (!Array.isArray(r.ingredients)) {
    errors.push(`${where} ingredients must be an array`);
  } else {
    r.ingredients.forEach((ing, j) => {
      if (ing === null || typeof ing !== 'object' || Array.isArray(ing)) {
        errors.push(`${where} ingredient #${j} is not an object`);
        return;
      }
      const ik = Object.keys(ing).sort();
      if (JSON.stringify(ik) !== JSON.stringify(['text', 'type'])) {
        errors.push(`${where} ingredient #${j} must have exactly {type, text}`);
      }
      if (!ingTypeEnum.includes(ing.type)) {
        errors.push(`${where} ingredient #${j} has invalid type ${JSON.stringify(ing.type)}`);
      }
      if (typeof ing.text !== 'string' || ing.text.trim() === '') {
        errors.push(`${where} ingredient #${j} text must be a non-empty string`);
      }
    });
  }

  // instructions
  if (!Array.isArray(r.instructions)) {
    errors.push(`${where} instructions must be an array`);
  } else {
    r.instructions.forEach((st, j) => {
      if (st === null || typeof st !== 'object' || Array.isArray(st)) {
        errors.push(`${where} instruction #${j} is not an object`);
        return;
      }
      if (typeof st.step !== 'string' || st.step.trim() === '') {
        errors.push(`${where} instruction #${j} step must be a non-empty string`);
      }
      if (typeof st.detail !== 'string') {
        errors.push(`${where} instruction #${j} detail must be a string`);
      }
      if ('type' in st && !ingTypeEnum.includes(st.type)) {
        errors.push(`${where} instruction #${j} has invalid type ${JSON.stringify(st.type)}`);
      }
      Object.keys(st).forEach((k) => {
        if (!instrKeys.includes(k)) errors.push(`${where} instruction #${j} has unknown field "${k}"`);
      });
    });
  }

  // non-blank recipes must actually have content
  if (r.is_blank === false) {
    const hasItem = Array.isArray(r.ingredients) && r.ingredients.some((x) => x && x.type === 'item');
    if (!hasItem) errors.push(`${where} is not blank but has no ingredient of type "item"`);
    if (!Array.isArray(r.instructions) || r.instructions.length === 0) {
      errors.push(`${where} is not blank but has no instructions`);
    }
  }
});

// duplicate ids
const idDups = [...seenIds.entries()].filter(([, c]) => c > 1);
if (idDups.length) {
  errors.push(
    `${idDups.length} duplicate recipe id(s): ` +
      idDups.map(([n, c]) => `"${n}" (×${c})`).join(', '),
  );
}

// ---------------------------------------------------------------------------
// Frozen id manifest (src/data/recipes.ids.json)
//
// These are data invariants, the same family as "unique names", so they are
// enforced HERE and not only in the test suite. `npm test` is a required check
// on every PR into main, but deploy.yml runs only `npm ci` + `npm run build` —
// so a guard that lives solely in a test does not run on the path that ships
// code. The manifest exists to stop silent state orphaning; it has to be
// enforced by the build.
// ---------------------------------------------------------------------------
const FIX_HINT =
  'Do NOT relax this check and do NOT edit recipes.ids.json `ids` — that entry is ' +
  "the localStorage key users already hold, and rewriting it orphans that recipe's " +
  'saved state. Add the id to the `renamed` allowlist in recipes.ids.json instead.';

const manifestIds = idManifest && typeof idManifest === 'object' ? idManifest.ids : null;
const renamedAllowlist =
  idManifest && typeof idManifest === 'object' && idManifest.renamed ? idManifest.renamed : {};

if (!manifestIds || typeof manifestIds !== 'object') {
  errors.push('recipes.ids.json is missing its `ids` map (expected { _doc, renamed, ids })');
} else {
  const byId = new Map(recipes.filter((r) => typeof r?.id === 'string').map((r) => [r.id, r]));

  // 1. An id, once assigned, never disappears.
  for (const [id, assignedName] of Object.entries(manifestIds)) {
    if (!byId.has(id)) {
      errors.push(
        `manifest id "${id}" (assigned to "${assignedName}") is gone from recipes.json. ` +
          'An id is permanent: it is never changed, renumbered or removed. ' + FIX_HINT,
      );
    }
  }

  // 2. Every record is listed. A new record must append an entry.
  for (const r of recipes) {
    if (typeof r?.id === 'string' && !(r.id in manifestIds)) {
      errors.push(
        `record "${r.name}" (id "${r.id}") has no entry in recipes.ids.json. ` +
          'Append one — the manifest is append-only, and a record missing from it ' +
          'cannot be migrated.',
      );
    }
  }

  // 3. A rename must be declared in the allowlist, not hidden by editing `ids`.
  for (const [id, assignedName] of Object.entries(manifestIds)) {
    const record = byId.get(id);
    if (!record || record.name === assignedName) continue;
    if (id in renamedAllowlist) continue;
    errors.push(
      `record "${record.name}" (id "${id}") was renamed from "${assignedName}". ` + FIX_HINT,
    );
  }

  // 4. The allowlist is not a junk drawer: every exemption must name a real id
  //    that really was renamed, or it is a blanket waiver hiding a future bug.
  for (const id of Object.keys(renamedAllowlist)) {
    const record = byId.get(id);
    if (!record) {
      errors.push(`renamed allowlist lists "${id}", which is not a recipe id in recipes.json`);
    } else if (record.name === manifestIds[id]) {
      errors.push(
        `renamed allowlist lists "${id}", but its name still matches the manifest ` +
          `("${record.name}"). Remove the stale exemption.`,
      );
    }
  }
}

// duplicate names
const dups = [...seen.entries()].filter(([, c]) => c > 1);
if (dups.length) {
  errors.push(
    `${dups.length} duplicate recipe name(s): ` +
      dups.map(([n, c]) => `"${n}" (×${c})`).join(', '),
  );
}

if (errors.length) {
  console.error(`✗ recipes.json failed validation (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  errors.slice(0, 200).forEach((e) => console.error('  - ' + e));
  if (errors.length > 200) console.error(`  ...and ${errors.length - 200} more`);
  process.exit(1);
}

console.log(
  `✓ recipes.json OK — ${recipes.length} records, ${seen.size} unique names, ${seenIds.size} unique ids, ` +
    `${manifestIds ? Object.keys(manifestIds).length : 0} manifest entries, validated against recipe.schema.json`,
);
