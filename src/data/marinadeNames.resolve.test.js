import { describe, it, expect, vi } from 'vitest';

// A live record whose name equals an old display-name alias must win in
// resolveRecipe. The real catalog has no such record, so this layers one on
// top of the real data: a Cookbook record named "Lemon Herb (Version 1)".
vi.mock('./recipes.json', async (importOriginal) => {
  const real = (await importOriginal()).default;
  return {
    default: [
      ...real,
      {
        id: 'fixture-live-lemon-herb',
        name: 'Lemon Herb (Version 1)',
        section: 'AMERICAN',
        category: 'American',
        source: 'Original',
        tags: ['#american'],
        ingredients: [{ type: 'item', text: '1 lemon' }],
        instructions: [{ step: 'Squeeze', detail: 'Squeeze the lemon.' }],
        is_blank: false,
      },
    ],
  };
});

const { resolveRecipe, legacyDisplayAliases } = await import('./recipeIndex.js');

describe('alias precedence in resolveRecipe', () => {
  it('resolves a live name that equals an alias to the live record', () => {
    expect(legacyDisplayAliases.get('Lemon Herb (Version 1)')).toBe('lemon-herb-chicken-marinade::v1');
    expect(resolveRecipe('Lemon Herb (Version 1)')?.id).toBe('fixture-live-lemon-herb');
  });

  it('still resolves other aliases to their row', () => {
    expect(resolveRecipe('Lemon Herb (Version 2)')?.id).toBe('lemon-herb-chicken-marinade::v2');
  });
});
