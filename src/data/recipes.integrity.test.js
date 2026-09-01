import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, it, expect } from 'vitest';
import recipes from './recipes.json';
import idManifest from './recipes.ids.json';
import { SECTIONS } from './sections.js';
import { displayRecipes, displayedBySection, recipesByName } from './recipeIndex.js';

// Integrity guard for the recipe catalog. Mirrors scripts/validate-recipes.mjs
// (the build-time check) so the invariants are enforced in CI tests too.
// `recipe.name` is the canonical key across the app (state, lookups, deep
// links), so duplicate names corrupt behavior — see issue #2.

describe('recipes.json integrity', () => {
  // Snapshot counts — bump these intentionally when the catalog changes so a
  // surprise add/drop of records is caught in review.
  const EXPECTED_RECORDS = 754;

  it('has the expected number of records', () => {
    expect(recipes.length).toBe(EXPECTED_RECORDS);
  });

  it('has exactly as many unique names as records (no duplicates)', () => {
    const names = recipes.map((r) => r.name);
    const unique = new Set(names);
    expect(unique.size).toBe(recipes.length);
  });

  it('lists no duplicate names', () => {
    const counts = new Map();
    for (const r of recipes) counts.set(r.name, (counts.get(r.name) || 0) + 1);
    const dups = [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n);
    expect(dups).toEqual([]);
  });

  it('gives every record a non-empty string name', () => {
    const bad = recipes.filter((r) => typeof r.name !== 'string' || r.name.trim() === '');
    expect(bad).toEqual([]);
  });

  it('only uses sections declared in sections.js', () => {
    const validKeys = new Set(SECTIONS.map((s) => s.key));
    const unknown = [...new Set(recipes.map((r) => r.section))].filter((s) => !validKeys.has(s));
    expect(unknown).toEqual([]);
  });

  // Every recipe must be cookable on its own. A step that names another recipe
  // ("slide the drumstick pan in", "425 F is the compromise temperature") makes
  // this one unusable without reading that one, and a later edit to that recipe
  // silently invalidates this one's timings.
  //
  // Match is CASE-SENSITIVE and word-bounded, so a generic serving suggestion
  // ("serve with mashed potatoes") does not trip on the recipe titled
  // "Mashed Potatoes". A name also present in this recipe's own ingredient list
  // is a sub-recipe it makes or uses (e.g. Taco Seasoning) and is allowed.
  it('has no recipe whose steps depend on another recipe by name', () => {
    const distinctive = recipes
      .map((r) => r.name)
      .filter((n) => n.length >= 14 && n.includes(' '));

    const offenders = [];
    for (const recipe of recipes) {
      const steps = (recipe.instructions ?? [])
        .map((s) => `${s.step ?? ''} ${s.detail ?? ''}`)
        .join(' ');
      const ingredients = (recipe.ingredients ?? []).map((i) => i.text ?? '').join(' ');
      for (const name of distinctive) {
        if (name === recipe.name) continue;
        const bounded = new RegExp(`(?<![A-Za-z])${name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(?![A-Za-z])`);
        if (!bounded.test(steps)) continue;
        if (ingredients.toLowerCase().includes(name.toLowerCase())) continue;
        offenders.push(`${recipe.name} -> ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// The rendered list and the name→recipe lookup must agree. Recipes in a
// `review: true` section are RENAMED at display time by expandVersionedRecipe,
// so a row can emit a name that is not in recipes.json. When the lookup was
// built from the raw file, all 121 expanded marinade rows resolved to null and
// clicking one silently rendered an empty card — nothing threw, so the
// ErrorBoundary never fired. These tests are that invariant.
describe('display list ↔ lookup identity', () => {
  it('resolves every name reachable from the rendered display list', () => {
    const unresolvable = displayRecipes
      .filter((r) => recipesByName.get(r.name)?.name !== r.name)
      .map((r) => `${r.name} [${r.section}]`);
    expect(unresolvable).toEqual([]);
  });

  it('resolves every name reachable from a rendered section', () => {
    const unresolvable = [];
    for (const [key, rows] of displayedBySection) {
      for (const row of rows) {
        if (recipesByName.get(row.name)?.name !== row.name) {
          unresolvable.push(`${row.name} [${key}]`);
        }
      }
    }
    expect(unresolvable).toEqual([]);
  });

  it('lists no duplicate names in the display list', () => {
    const counts = new Map();
    for (const r of displayRecipes) counts.set(r.name, (counts.get(r.name) || 0) + 1);
    const dups = [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n);
    expect(dups).toEqual([]);
  });

  it('renders every raw record as at least one display row', () => {
    expect(displayRecipes.length).toBeGreaterThanOrEqual(recipes.length);
    const sections = new Set(displayRecipes.map((r) => r.section));
    expect([...new Set(recipes.map((r) => r.section))].filter((s) => !sections.has(s))).toEqual([]);
  });

  // Expansion splits one record's ingredients/instructions across its versions.
  // A version that lands empty would render a card with no method at all.
  it('gives every non-blank display row ingredients and instructions', () => {
    const empty = displayRecipes
      .filter((r) => !r.is_blank && (!r.ingredients?.length || !r.instructions?.length))
      .map((r) => r.name);
    expect(empty).toEqual([]);
  });
});

// `id` is the record's permanent identity, assigned once and FROZEN. It is a
// slug of the name at assignment time, but it is not a function of the name:
// renaming a recipe must never change its id, and nothing may recompute one at
// runtime. src/data/recipes.ids.json is the frozen {id: nameAtAssignment}
// manifest — it is both the anti-drift guard here and the frozen legacy-name
// snapshot stateMigration.js reads. It is APPEND-ONLY: see the _doc block in
// the file itself.
describe('recipe ids', () => {
  const ID_PATTERN = /^[a-z0-9-]+$/;

  it('gives every record an id, as its first field', () => {
    const missing = recipes.filter((r) => typeof r.id !== 'string' || r.id === '').map((r) => r.name);
    expect(missing).toEqual([]);
    const notFirst = recipes.filter((r) => Object.keys(r)[0] !== 'id').map((r) => r.name);
    expect(notFirst).toEqual([]);
  });

  it('gives every id the required shape', () => {
    const bad = recipes.filter((r) => !ID_PATTERN.test(r.id)).map((r) => `${r.name} -> ${r.id}`);
    expect(bad).toEqual([]);
  });

  it('has exactly as many unique ids as records', () => {
    expect(new Set(recipes.map((r) => r.id)).size).toBe(recipes.length);
  });

  // The drift guard proper: an id, once assigned, never changes and never
  // disappears. This is what makes "renamed the recipe, regenerated the id"
  // unmergeable — the old id would vanish from recipes.json.
  it('still holds every id in the frozen manifest', () => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const gone = Object.entries(idManifest.ids)
      .filter(([id]) => !byId.has(id))
      .map(([id, name]) => `${id}: gone from recipes.json (was "${name}")`);
    expect(gone).toEqual([]);
  });

  // The manifest records the name each id was assigned AGAINST, which is also
  // the localStorage key users held before the migration.
  //
  // NOTE for the first legitimate rename: do NOT edit the manifest and do NOT
  // relax this test. Add the record's id to the `renamed` allowlist in
  // recipes.ids.json instead. The manifest is a frozen historical snapshot —
  // rewriting an entry to a recipe's new name makes the migration look up a key
  // nobody has and silently orphans that record's saved state. An allowlist
  // accumulates evidence; a relaxed test just erodes.
  it('still maps every id to the name it was assigned against', () => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const allowed = idManifest.renamed ?? {};
    const drifted = Object.entries(idManifest.ids)
      .filter(([id, name]) => byId.has(id) && byId.get(id).name !== name)
      .filter(([id]) => !(id in allowed))
      .map(([id, name]) => `${id}: "${name}" -> "${byId.get(id).name}"`);
    expect(drifted).toEqual([]);
  });

  it('keeps the renamed allowlist honest', () => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    // An allowlist entry must name a real id that HAS actually been renamed —
    // otherwise it is a blanket exemption waiting to hide a future mistake.
    const stale = Object.keys(idManifest.renamed ?? {}).filter(
      (id) => !byId.has(id) || byId.get(id).name === idManifest.ids[id],
    );
    expect(stale).toEqual([]);
  });

  it('keeps the manifest append-only in shape', () => {
    expect(Object.keys(idManifest)).toEqual(['_doc', 'renamed', 'ids']);
    expect(Array.isArray(idManifest._doc)).toBe(true);
  });

  it('gives every record a manifest entry', () => {
    const unlisted = recipes.filter((r) => !(r.id in idManifest.ids)).map((r) => `${r.name} (${r.id})`);
    expect(unlisted).toEqual([]);
    expect(Object.keys(idManifest.ids)).toHaveLength(recipes.length);
  });

  // Ids are frozen, so the slug function must not be reachable at runtime — its
  // only copy is the one-time assignment script, kept outside the repo. Test
  // files are excluded: they are not shipped and cannot un-freeze anything.
  const shippedSources = () => {
    const walk = (dir) => readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
    return walk('src').filter((f) => /\.(js|jsx)$/.test(f) && !/\.test\.(js|jsx)$/.test(f));
  };

  it('ships no slug-from-name helper anywhere under src/', () => {
    const offenders = shippedSources().filter((f) => {
      const src = readFileSync(f, 'utf8');
      // A slugifier by name, or anything lowercasing a `.name` and punching it
      // into dashes — the exact move that would un-freeze an id.
      //
      // DO NOT "tighten" this to any lowercase+replace: RecipeList builds a DOM
      // anchor from a SECTION KEY (`sec-peanut-${base.toLowerCase().replace(…)}`)
      // and that is legitimate — it derives an anchor from a section, not an id
      // from a recipe name. It is missed on purpose, not by luck. scripts/ is
      // also deliberately out of scope: the one-time assignment script owns the
      // only real slug function and must keep it.
      return /slug/i.test(src) || /\.name[\s\S]{0,40}toLowerCase\(\)[\s\S]{0,40}replace\(/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  // The manifest is legacy-name data. Only the resolution layer and the
  // migration may touch it — a component or hook reading it would mean name
  // lookups leaking back into the UI, which is what the id pass removed.
  it('keeps the id manifest inside the data layer', () => {
    const readers = shippedSources()
      .filter((f) => readFileSync(f, 'utf8').includes('recipes.ids.json'))
      .map((f) => f.split(sep).join('/'));
    expect(readers.sort()).toEqual([
      'src/data/recipeIndex.js',
      'src/data/stateMigration.js',
    ]);
  });
});

// The #40 / #43 bug class, pinned. Version markers are meaningful only where
// expansion runs (review: true sections). A record outside one that carries a
// "Version N" marker renders every version mashed into a single card — which is
// exactly what "Tandoori - Chicken Marinade" did until it was split in #43.
// Semantic sub-group headers ("Glaze", "Rub", "Sauce") are correct and are NOT
// what this guards against.
describe('version markers stay inside review sections', () => {
  const VERSION_LABEL = /^Version\s*\d/;
  const reviewKeys = new Set(SECTIONS.filter((s) => s.review).map((s) => s.key));

  it('has no version-labelled marker outside a review section', () => {
    const offenders = [];
    for (const recipe of recipes) {
      if (reviewKeys.has(recipe.section)) continue;
      for (const ing of recipe.ingredients ?? []) {
        if (ing.type === 'section' && VERSION_LABEL.test(ing.text ?? '')) {
          offenders.push(`${recipe.name} [${recipe.section}] ingredient: "${ing.text}"`);
        }
      }
      for (const step of recipe.instructions ?? []) {
        if (step.type === 'section' && VERSION_LABEL.test(step.step ?? '')) {
          offenders.push(`${recipe.name} [${recipe.section}] instruction: "${step.step}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
