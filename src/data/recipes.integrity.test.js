import { describe, it, expect } from 'vitest';
import recipes from './recipes.json';
import { SECTIONS } from './sections.js';

// Integrity guard for the recipe catalog. Mirrors scripts/validate-recipes.mjs
// (the build-time check) so the invariants are enforced in CI tests too.
// `recipe.name` is the canonical key across the app (state, lookups, deep
// links), so duplicate names corrupt behavior — see issue #2.

describe('recipes.json integrity', () => {
  // Snapshot counts — bump these intentionally when the catalog changes so a
  // surprise add/drop of records is caught in review.
  const EXPECTED_RECORDS = 232;

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
});
