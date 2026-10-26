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

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SECTIONS } from '../src/data/sections.js';
import { CONTROLLED_TAGS } from '../src/data/tagFacets.js';
import { AUTO_TAG_VOCABULARY } from '../src/utils/autoTags.js';

// The tags a WRITTEN recipe may carry by hand: the controlled list in
// src/data/tagFacets.js (docs/internal/tag-criteria.md says what earns a place
// there), plus any tag the auto-tags can derive, for the cases where the
// auto-tags do not supply it on that recipe. Anything else is a typo or an
// unapproved tag, and fails the build. Blank placeholders are exempt until they
// are written: their tags are checked the day is_blank turns false.
const ALLOWED_TAGS = new Set([...CONTROLLED_TAGS, ...AUTO_TAG_VOCABULARY]);

// Photo weight ceiling. An untreated phone photo runs 3-5 MB; the collection has
// hundreds of records, so accepting them would put hundreds of megabytes of
// binaries into git history permanently AND push the published site past the
// GitHub Pages 1 GB limit. A resized JPEG of the same dish is ~150-300 KB and
// looks identical at the size it is displayed, so the ceiling costs nothing.
const MAX_IMAGE_BYTES = 500 * 1024;

// Technique diagrams are SVG, which is code as much as image: ceiling on weight,
// and no script or event handler may ride along in one that ships to every reader.
const MAX_DIAGRAM_BYTES = 150 * 1024;
// Each SVG has a committed PNG companion the recipe card embeds (scripts/rasterize-diagrams.mjs).
const MAX_DIAGRAM_PNG_BYTES = 400 * 1024;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(root, 'src/data/recipe.schema.json'), 'utf8'));
const recipes = JSON.parse(readFileSync(join(root, 'src/data/recipes.json'), 'utf8'));
const idManifest = JSON.parse(readFileSync(join(root, 'src/data/recipes.ids.json'), 'utf8'));
const baselineFile = JSON.parse(readFileSync(join(root, 'src/data/cookbookBaseline.json'), 'utf8'));

// The Cookbook baseline (src/data/cookbookBaseline.json) is the set of written
// Cookbook recipes that were live before the `added` field existed. It is
// FROZEN: it never grows, and a recipe that goes live later carries `added`
// instead. This count is hand-authored, like EXPECTED_RECORDS in recordCount.js,
// and deliberately not computed from the file it guards: a surprise add or drop
// moves the file away from this number and the build fails.
const BASELINE_SIZE = 66;
const baselineIds = Array.isArray(baselineFile?.ids) ? baselineFile.ids : [];
const baselineSet = new Set(baselineIds);

// Today's date in Central time, "YYYY-MM-DD". Never new Date("YYYY-MM-DD"),
// which is UTC midnight; CI runs in UTC, so that would be a day off every evening.
const todayCentral = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

function isRealDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// "PT", "PT0M", "PT0H0M" match the duration pattern but wait for nothing.
const isZeroDuration = (s) => !/[1-9]/.test(s);

const errors = [];
const props = schema.properties;
const diagramItem = props.diagrams.items;
const diagramKeys = Object.keys(diagramItem.properties);
const diagramSrcPattern = new RegExp(diagramItem.properties.src.pattern);
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

  // Optional fields — absent is always valid; present must be well formed.
  const optionalStrings = ['image', 'description', 'prepTime', 'cookTime', 'recipeYield', 'waitTime', 'waitLabel', 'added'];
  optionalStrings.forEach((k) => {
    if (!(k in r)) return;
    if (typeof r[k] !== 'string' || r[k].trim() === '') {
      errors.push(`${where} ${k} must be a non-empty string when present`);
      return;
    }
    const pattern = props[k].pattern;
    if (pattern && !new RegExp(pattern).test(r[k])) {
      errors.push(`${where} ${k} ${JSON.stringify(r[k])} must match ${pattern}`);
    }
    const max = props[k].maxLength;
    if (max && r[k].length > max) {
      errors.push(`${where} ${k} is ${r[k].length} chars, over the ${max} limit`);
    }
  });

  // Google pairs the two times; one without the other yields no rich-result
  // benefit and reads as missing data.
  if (('prepTime' in r) !== ('cookTime' in r)) {
    errors.push(`${where} has only one of prepTime/cookTime — author both or neither`);
  }

  // waitTime/waitLabel: a pair, only on a written record, and a real wait.
  if (('waitTime' in r) !== ('waitLabel' in r)) {
    errors.push(`${where} has only one of waitTime/waitLabel — author both or neither`);
  }
  if (r.is_blank === true) {
    ['waitTime', 'waitLabel'].forEach((k) => {
      if (k in r) errors.push(`${where} is blank but has ${k} — wait fields are for written records only`);
    });
  }
  if (
    typeof r.waitTime === 'string' &&
    new RegExp(props.waitTime.pattern).test(r.waitTime) &&
    isZeroDuration(r.waitTime)
  ) {
    errors.push(`${where} waitTime ${JSON.stringify(r.waitTime)} must be greater than zero`);
  }

  // added: the Cookbook go-live date. See cookbookBaseline.json.
  if (typeof r.is_blank === 'boolean') {
    const writtenCookbook = r.is_blank === false && r.section !== 'CHEFS DRAFTS';
    const onBaseline = typeof r.id === 'string' && baselineSet.has(r.id);
    if (!writtenCookbook) {
      if ('added' in r) {
        const kind = r.is_blank ? 'blank' : 'a Chef draft';
        errors.push(`${where} has "added" but is ${kind} — only a written Cookbook record goes live`);
      }
    } else if (onBaseline) {
      if ('added' in r) {
        errors.push(`${where} is in cookbookBaseline.json (live before "added" existed) and must not carry "added"`);
      }
    } else if (!('added' in r)) {
      errors.push(
        `${where} is a written Cookbook record not in cookbookBaseline.json, so it needs "added" ` +
          '(go-live date, YYYY-MM-DD, Central time)',
      );
    }
    if (typeof r.added === 'string') {
      if (!isRealDate(r.added)) {
        errors.push(`${where} added ${JSON.stringify(r.added)} must be a real calendar date, YYYY-MM-DD`);
      } else if (r.added > todayCentral) {
        errors.push(`${where} added ${r.added} is in the future (today in Central is ${todayCentral})`);
      }
    }
  }

  // A photo that is referenced but not committed is a broken image in
  // production and a broken og:image in every share of it. One that IS
  // committed but never resized is a permanent weight in git history — see
  // MAX_IMAGE_BYTES above and docs/internal/adding-a-photo.md.
  if (typeof r.image === 'string') {
    const photo = join(root, 'public', r.image);
    if (!existsSync(photo)) {
      errors.push(`${where} image "${r.image}" does not exist at public/${r.image}`);
    } else {
      const bytes = statSync(photo).size;
      if (bytes > MAX_IMAGE_BYTES) {
        errors.push(
          `${where} image "${r.image}" is ${Math.round(bytes / 1024)} KB, over the ` +
            `${MAX_IMAGE_BYTES / 1024} KB limit — resize it to about 1600px wide and ` +
            're-save as JPEG quality 80 (see docs/internal/adding-a-photo.md)',
        );
      }
    }
  }

  // tags
  if (!Array.isArray(r.tags)) {
    errors.push(`${where} tags must be an array`);
  } else {
    r.tags.forEach((t) => {
      if (typeof t !== 'string' || !tagPattern.test(t)) {
        errors.push(`${where} has invalid tag ${JSON.stringify(t)} (must match ${props.tags.items.pattern})`);
      } else if (r.is_blank === false && !ALLOWED_TAGS.has(t)) {
        errors.push(
          `${where} has tag ${t}, which is not on the controlled list (src/data/tagFacets.js) ` +
            'or an auto-tag (src/utils/autoTags.js). A new tag is a deliberate edit to tagFacets.js; ' +
            'see docs/internal/tag-criteria.md',
        );
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
      if ('why' in st && (typeof st.why !== 'string' || st.why.trim() === '')) {
        errors.push(`${where} instruction #${j} why must be a non-empty string when present`);
      }
      Object.keys(st).forEach((k) => {
        if (!instrKeys.includes(k)) errors.push(`${where} instruction #${j} has unknown field "${k}"`);
      });
    });
  }

  // notes - optional; when present, a non-empty array of non-empty strings.
  // An empty array is rejected rather than tolerated: omit the field instead.
  if ('notes' in r) {
    if (!Array.isArray(r.notes) || r.notes.length === 0) {
      errors.push(`${where} notes must be a non-empty array when present`);
    } else {
      r.notes.forEach((note, j) => {
        if (typeof note !== 'string' || note.trim() === '') {
          errors.push(`${where} note #${j} must be a non-empty string`);
        }
      });
    }
  }

  // diagrams - optional; when present, a non-empty array of {src, alt, caption?}.
  // The file must be committed, small, and free of script (see MAX_DIAGRAM_BYTES).
  if ('diagrams' in r) {
    if (!Array.isArray(r.diagrams) || r.diagrams.length === 0) {
      errors.push(`${where} diagrams must be a non-empty array when present`);
    } else {
      r.diagrams.forEach((d, j) => {
        const at = `${where} diagram #${j}`;
        if (d === null || typeof d !== 'object' || Array.isArray(d)) {
          errors.push(`${at} must be an object`);
          return;
        }
        Object.keys(d).forEach((k) => {
          if (!diagramKeys.includes(k)) errors.push(`${at} has unknown field "${k}"`);
        });
        diagramItem.required.forEach((k) => {
          if (!(k in d)) errors.push(`${at} is missing required field "${k}"`);
        });
        ['alt', 'caption'].forEach((k) => {
          if (k in d && (typeof d[k] !== 'string' || d[k].trim() === '')) {
            errors.push(`${at} ${k} must be a non-empty string when present`);
          }
        });
        if ('src' in d) {
          if (typeof d.src !== 'string' || !diagramSrcPattern.test(d.src)) {
            errors.push(`${at} src ${JSON.stringify(d.src)} must match ${diagramItem.properties.src.pattern}`);
          } else {
            const file = join(root, 'public', d.src);
            if (!existsSync(file)) {
              errors.push(`${at} src "${d.src}" does not exist at public/${d.src}`);
            } else {
              const bytes = statSync(file).size;
              if (bytes > MAX_DIAGRAM_BYTES) {
                errors.push(
                  `${at} src "${d.src}" is ${Math.round(bytes / 1024)} KB, over the ` +
                    `${MAX_DIAGRAM_BYTES / 1024} KB limit (see docs/internal/adding-a-diagram.md)`,
                );
              }
              const svg = readFileSync(file, 'utf8');
              if (/<script/i.test(svg)) errors.push(`${at} src "${d.src}" contains a <script> element`);
              if (/[\s"'/]on[a-z]+\s*=/i.test(svg)) {
                errors.push(`${at} src "${d.src}" contains an on...= event-handler attribute`);
              }
              const png = file.replace(/\.svg$/, '.png');
              const pngSrc = d.src.replace(/\.svg$/, '.png');
              if (!existsSync(png)) {
                errors.push(
                  `${at} src "${d.src}" has no PNG companion at public/${pngSrc} ` +
                    '(run node scripts/rasterize-diagrams.mjs; see docs/internal/adding-a-diagram.md)',
                );
              } else if (statSync(png).size > MAX_DIAGRAM_PNG_BYTES) {
                errors.push(
                  `${at} PNG companion "${pngSrc}" is ${Math.round(statSync(png).size / 1024)} KB, over the ` +
                    `${MAX_DIAGRAM_PNG_BYTES / 1024} KB limit (see docs/internal/adding-a-diagram.md)`,
                );
              }
            }
          }
        }
      });
    }
  }

  // non-blank recipes must actually have content
  if (r.is_blank === false) {
    const hasItem = Array.isArray(r.ingredients) && r.ingredients.some((x) => x && x.type === 'item');
    if (!hasItem) errors.push(`${where} is not blank but has no ingredient of type "item"`);
    if (!('description' in r)) errors.push(`${where} is not blank but has no description`);
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
  'saved state. Add the id to the `renamed` allowlist in recipes.ids.json instead ' +
  '(or, for a deliberate removal, to `removed` with its successor).';

const manifestIds = idManifest && typeof idManifest === 'object' ? idManifest.ids : null;
const renamedAllowlist =
  idManifest && typeof idManifest === 'object' && idManifest.renamed ? idManifest.renamed : {};

// Removed records: { id: { to: successorId | null, note, versions? } }. A removed
// id keeps its `ids` entry forever; this map is what lets it leave recipes.json.
const removedRaw = idManifest && typeof idManifest === 'object' ? idManifest.removed : undefined;
const removedMap =
  removedRaw && typeof removedRaw === 'object' && !Array.isArray(removedRaw) ? removedRaw : {};
if (removedRaw !== undefined && removedMap !== removedRaw) {
  errors.push('recipes.ids.json `removed` must be an object ({ id: { to, note } })');
}

if (!manifestIds || typeof manifestIds !== 'object') {
  errors.push('recipes.ids.json is missing its `ids` map (expected { _doc, renamed, removed, ids })');
} else {
  const byId = new Map(recipes.filter((r) => typeof r?.id === 'string').map((r) => [r.id, r]));

  // 1. An id, once assigned, never disappears - unless it is declared in `removed`.
  for (const [id, assignedName] of Object.entries(manifestIds)) {
    if (id in removedMap) continue;
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
  //    A removed id keeps its exemption, as it keeps its `ids` entry: the
  //    manifest is append-only, and the rename is still part of its history.
  for (const id of Object.keys(renamedAllowlist)) {
    if (id in removedMap) continue;
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

  // 5. Removed ids. Each one is really gone, still has its frozen `ids` entry,
  //    and points at a live successor (or null). No chains: a successor that is
  //    itself removed would need a second hop nobody resolves.
  for (const [id, entry] of Object.entries(removedMap)) {
    const where = `removed entry "${id}"`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${where} must be an object { to, note }`);
      continue;
    }
    if (byId.has(id)) {
      errors.push(`${where} is still in recipes.json. Remove the record, or remove it from \`removed\`.`);
    }
    if (!(id in manifestIds)) {
      errors.push(
        `${where} is not in recipes.ids.json \`ids\`. A removed id keeps its \`ids\` entry forever.`,
      );
    }
    if (!('to' in entry)) {
      errors.push(`${where} is missing \`to\` (a successor id, or null)`);
    } else if (entry.to !== null) {
      if (typeof entry.to !== 'string' || !byId.has(entry.to)) {
        errors.push(`${where} has successor ${JSON.stringify(entry.to)}, which is not a recipe id in recipes.json`);
      } else if (entry.to in removedMap) {
        errors.push(`${where} has successor "${entry.to}", which is itself removed (no chains)`);
      }
    }
    if (typeof entry.note !== 'string' || entry.note.trim() === '') {
      errors.push(`${where} needs a non-empty \`note\` saying why it was removed`);
    }
    if ('versions' in entry && !(Number.isInteger(entry.versions) && entry.versions > 0)) {
      errors.push(`${where} has versions ${JSON.stringify(entry.versions)}; it must be a positive integer`);
    }
    for (const k of Object.keys(entry)) {
      if (!['to', 'note', 'versions'].includes(k)) errors.push(`${where} has unknown field "${k}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Frozen Cookbook baseline (src/data/cookbookBaseline.json)
//
// Enforced here, in the build path, for the same reason as the manifest above.
// ---------------------------------------------------------------------------
if (!Array.isArray(baselineFile?.ids)) {
  errors.push('cookbookBaseline.json is missing its `ids` array');
} else {
  if (baselineIds.length !== BASELINE_SIZE) {
    errors.push(
      `cookbookBaseline.json has ${baselineIds.length} entries, expected exactly ${BASELINE_SIZE}. ` +
        'The baseline is frozen: it never grows, and an id leaves it only by being removed from the catalog.',
    );
  }
  const baseDups = [...new Set(baselineIds.filter((id, i) => baselineIds.indexOf(id) !== i))];
  if (baseDups.length) errors.push(`cookbookBaseline.json has duplicate id(s): ${baseDups.join(', ')}`);
  const liveIds = new Set(recipes.filter((r) => typeof r?.id === 'string').map((r) => r.id));
  for (const id of baselineIds) {
    if (!manifestIds || !(id in manifestIds)) {
      errors.push(`cookbookBaseline.json id "${id}" is not in recipes.ids.json \`ids\``);
    }
    if (!liveIds.has(id) && !(id in removedMap)) {
      errors.push(`cookbookBaseline.json id "${id}" is neither a live record nor declared in \`removed\``);
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
    `${manifestIds ? Object.keys(manifestIds).length : 0} manifest entries, ` +
    `${Object.keys(removedMap).length} removed, validated against recipe.schema.json`,
);
