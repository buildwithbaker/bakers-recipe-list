import { describe, it, expect } from 'vitest';
import mealSets from '../data/mealSets.json';
import { recipesById } from '../data/recipeIndex.js';
import { linkIngredientText, linkTargetsFor, mealBlocksFor, setsOf } from './mealSets.js';

describe('meal sets data', () => {
  it('has the three decided sets, in order, and every member is a written recipe', () => {
    expect(mealSets.map((s) => s.id)).toEqual(['shawarma-wrap-night', 'blackened-chicken-dinner', 'lebanese-kafta-dinner']);
    for (const set of mealSets) {
      for (const id of set.recipes) {
        expect(recipesById.get(id)?.is_blank, id).toBe(false);
      }
    }
  });
});

describe('mealBlocksFor', () => {
  it('lists the other members in set order, excluding the recipe itself', () => {
    const [block] = mealBlocksFor('sheet-pan-chicken-shawarma-breasts');
    expect(block.set.id).toBe('shawarma-wrap-night');
    expect(block.others.map((r) => r.id)).toEqual(['quinoa', 'smashed-spiced-cucumbers-mint', 'quick-pickled-red-onions']);
  });

  it('is symmetric: every member links to every other member', () => {
    for (const set of mealSets) {
      for (const id of set.recipes) {
        expect(mealBlocksFor(id).find((b) => b.set.id === set.id).others.map((r) => r.id))
          .toEqual(set.recipes.filter((x) => x !== id));
      }
    }
  });

  it('gives one block per set, and none for a recipe in no set', () => {
    const sets = [{ id: 'a-b', name: 'A', recipes: ['x', 'y'] }, { id: 'c-d', name: 'C', recipes: ['x', 'z'] }];
    const byId = new Map([['x', { id: 'x' }], ['y', { id: 'y' }], ['z', { id: 'z' }]]);
    expect(mealBlocksFor('x', sets, byId).map((b) => b.set.id)).toEqual(['a-b', 'c-d']);
    expect(mealBlocksFor('nope', sets, byId)).toEqual([]);
    expect(setsOf('lasagna')).toEqual([]);
  });
});

describe('linkIngredientText', () => {
  const targets = [
    { id: 'cuc', name: 'Smashed Spiced Cucumbers with Mint' },
    { id: 'red', name: 'Quick Pickled Red Onions' },
  ];

  it('links the exact name, case-insensitively, and leaves the rest plain', () => {
    expect(linkIngredientText('smashed spiced cucumbers with mint, drained', targets)).toEqual([
      { text: 'smashed spiced cucumbers with mint', id: 'cuc' },
      { text: ', drained' },
    ]);
  });

  it('needs a whole-word match', () => {
    expect(linkIngredientText('Quick Pickled Red Onionsy', targets)).toEqual([{ text: 'Quick Pickled Red Onionsy' }]);
    expect(linkIngredientText('1 cup romaine', targets)).toEqual([{ text: '1 cup romaine' }]);
  });

  it('joins back to the original text', () => {
    const t = 'Smashed Spiced Cucumbers with Mint, drained';
    expect(linkIngredientText(t, targets).map((p) => p.text).join('')).toBe(t);
  });

  it('takes its targets from the recipe own sets only', () => {
    expect(linkTargetsFor('sheet-pan-chicken-shawarma-breasts').map((r) => r.id).sort())
      .toEqual(['quick-pickled-red-onions', 'quinoa', 'smashed-spiced-cucumbers-mint']);
    expect(linkTargetsFor('lasagna')).toEqual([]);
  });
});
