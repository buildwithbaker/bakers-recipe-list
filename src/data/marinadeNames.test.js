import { describe, it, expect } from 'vitest';
import { expandVersionedRecipe, legacyShortenName, shortenName } from './expandVersions.js';
import {
  displayRecipes,
  legacyDisplayAliasCollisions,
  legacyDisplayAliases,
  recipesById,
  resolveRecipe,
} from './recipeIndex.js';
import { buildNameToId, migrateState, STORES, STATE_VERSION_KEY } from './stateMigration.js';
import { recipePath } from '../utils/recipeRoute.js';

// Batch E (audit P2-13): For Review marinade rows keep their protein in the
// displayed name. Display only - ids, ::vN keys and slugs are untouched, and
// the names rows carried before the change stay resolvable as aliases.

describe('marinade display names', () => {
  it('keeps the protein: "X - Chicken Marinade" and "X - Pork Marinade"', () => {
    expect(shortenName('Teriyaki - Chicken Marinade')).toBe('Teriyaki Chicken Marinade');
    expect(shortenName('Teriyaki (Japanese-style) - Pork Marinade')).toBe('Teriyaki (Japanese-style) Pork Marinade');
  });

  it('drops the doubled Marinade: "X Marinade - Beef Marinade"', () => {
    expect(shortenName('Teriyaki Marinade - Beef Marinade')).toBe('Teriyaki Beef Marinade');
  });

  it('leaves a name that matches neither pattern as it is', () => {
    expect(shortenName('Chicken Marinade - Lemon Herb Yogurt')).toBe('Chicken Marinade - Lemon Herb Yogurt');
    expect(shortenName('Tandoori Chicken Marinade')).toBe('Tandoori Chicken Marinade');
  });

  it('builds the row name with " (Version n)" as before', () => {
    const rows = expandVersionedRecipe({
      id: 'fixture',
      name: 'Teriyaki - Chicken Marinade',
      source: 'Original',
      ingredients: [
        { type: 'section', text: 'Version 1 - One' },
        { type: 'item', text: '1 cup soy sauce' },
        { type: 'section', text: 'Version 2 - Two' },
        { type: 'item', text: '1 cup mirin' },
      ],
      instructions: [],
    });
    expect(rows.map((r) => [r.id, r.name])).toEqual([
      ['fixture::v1', 'Teriyaki Chicken Marinade (Version 1)'],
      ['fixture::v2', 'Teriyaki Chicken Marinade (Version 2)'],
    ]);
  });

  it('keeps the frozen legacy rule producing the old names', () => {
    expect(legacyShortenName('Teriyaki - Chicken Marinade')).toBe('Teriyaki');
    expect(legacyShortenName('Teriyaki Marinade - Beef Marinade')).toBe('Teriyaki Marinade');
  });
});

describe('old display names stay resolvable (frozen aliases)', () => {
  const V1 = 'lemon-herb-chicken-marinade::v1';

  it('registers an alias for every renamed row, with no collisions', () => {
    expect(legacyDisplayAliasCollisions).toEqual([]);
    expect(legacyDisplayAliases.size).toBeGreaterThan(0);
    expect(legacyDisplayAliases.get('Lemon Herb (Version 1)')).toBe(V1);
    // Every alias points at a real row whose CURRENT name differs from it.
    for (const [name, id] of legacyDisplayAliases) {
      expect(recipesById.get(id)?.name).toBeDefined();
      expect(recipesById.get(id).name).not.toBe(name);
    }
  });

  it('never shadows a current name', () => {
    const current = new Set(displayRecipes.map((r) => r.name));
    expect([...legacyDisplayAliases.keys()].filter((n) => current.has(n))).toEqual([]);
  });

  it('resolves an old display name, and an old ?recipe= link lands on the same row', () => {
    const row = resolveRecipe(V1);
    expect(row.name).toBe('Lemon Herb Chicken Marinade (Version 1)');
    expect(resolveRecipe('Lemon Herb (Version 1)')).toBe(row);
    // App.jsx resolves ?recipe=<key> through resolveRecipe, then routes to the row's path.
    expect(recipePath(resolveRecipe('Lemon Herb (Version 1)').id, '/bakers-recipe-list/'))
      .toBe('/bakers-recipe-list/r/lemon-herb-chicken-marinade--v1/');
    expect(resolveRecipe('Teriyaki Marinade (Version 2)')?.id).toBe('teriyaki-marinade-beef-marinade::v2');
  });

  it('migrates pre-migration saved state keyed by an old display name to the right id', () => {
    const data = new Map([
      [STORES.made, JSON.stringify(['Lemon Herb (Version 1)', 'Teriyaki Marinade (Version 2)'])],
      [STORES.cookLog, JSON.stringify({ 'Lemon Herb (Version 1)': { dates: [], notes: 'kept' } })],
    ]);
    const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    expect(migrateState({ storage }).status).toBe('migrated');
    expect(JSON.parse(data.get(STORES.made))).toEqual([V1, 'teriyaki-marinade-beef-marinade::v2']);
    expect(JSON.parse(data.get(STORES.cookLog))[V1]).toEqual({ dates: [], notes: 'kept' });
    expect(data.get(STATE_VERSION_KEY)).toBe('2');
  });

  it('lets a live name that equals an alias win in the migration map', () => {
    const records = [
      { id: 'live-recipe', name: 'Pesto' },
      { id: 'pesto-chicken-marinade::v1', name: 'Pesto Chicken Marinade (Version 1)' },
    ];
    const aliases = new Map([
      ['Pesto', 'pesto-chicken-marinade::v1'],
      ['Pesto (Version 1)', 'pesto-chicken-marinade::v1'],
    ]);
    const map = buildNameToId(records, { ids: {} }, aliases);
    expect(map.get('Pesto')).toBe('live-recipe');
    expect(map.get('Pesto (Version 1)')).toBe('pesto-chicken-marinade::v1');
  });
});
