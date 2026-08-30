import { describe, it, expect } from 'vitest';
import recipes from './recipes.json';
import { SECTIONS } from './sections.js';
import { displayRecipes, displayedBySection, recipesByName } from './recipeIndex.js';

// Integrity guard for the recipe catalog. Mirrors scripts/validate-recipes.mjs
// (the build-time check) so the invariants are enforced in CI tests too.
// `recipe.name` is the canonical key across the app (state, lookups, deep
// links), so duplicate names corrupt behavior — see issue #2.

describe('recipes.json integrity', () => {
  // Snapshot counts — bump these intentionally when the catalog changes so a
  // surprise add/drop of records is caught in review.
  const EXPECTED_RECORDS = 753;

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
