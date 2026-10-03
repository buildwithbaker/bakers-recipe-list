import { describe, it, expect, vi } from 'vitest';

// resolveRecipe itself, end to end, against a fixture `removed` map layered on
// the real manifest. The real records are untouched: the fixture removes ids
// that never existed in recipes.json, pointing at real live successors.
vi.mock('./recipes.ids.json', async (importOriginal) => {
  const real = (await importOriginal()).default;
  return {
    default: {
      ...real,
      removed: {
        'fixture-removed-plain': { to: 'spicy-pork-patties', note: 'fixture' },
        'fixture-removed-null': { to: null, note: 'fixture' },
        'fixture-removed-versioned': { to: 'beef-stew', note: 'fixture', versions: 2 },
      },
      ids: {
        ...real.ids,
        'fixture-removed-plain': 'Fixture Removed Plain',
        'fixture-removed-null': 'Fixture Removed Null',
        'fixture-removed-versioned': 'Fixture Removed Versioned',
      },
    },
  };
});

const { resolveRecipe } = await import('./recipeIndex.js');

describe('resolveRecipe with removed ids', () => {
  it('resolves a removed id and its legacy name to the successor', () => {
    expect(resolveRecipe('fixture-removed-plain')?.id).toBe('spicy-pork-patties');
    expect(resolveRecipe('Fixture Removed Plain')?.id).toBe('spicy-pork-patties');
  });

  it('returns null for a removed id with to: null', () => {
    expect(resolveRecipe('fixture-removed-null')).toBeNull();
    expect(resolveRecipe('Fixture Removed Null')).toBeNull();
  });

  it('resolves a removed versioned id and each <removed>::vN to the successor', () => {
    expect(resolveRecipe('fixture-removed-versioned')?.id).toBe('beef-stew');
    expect(resolveRecipe('fixture-removed-versioned::v2')?.id).toBe('beef-stew');
  });

  it('still resolves live ids and names exactly as before', () => {
    expect(resolveRecipe('spicy-pork-patties')?.id).toBe('spicy-pork-patties');
    expect(resolveRecipe('Spicy Pork Patties')?.id).toBe('spicy-pork-patties');
    expect(resolveRecipe('no-such-recipe')).toBeNull();
  });
});
