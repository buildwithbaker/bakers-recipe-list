import { describe, it, expect } from 'vitest';
import { techniqueIdsOf, techniquesOf, recipesUsingTechnique } from './techniqueUsage.js';
import { rawRecipes } from '../data/recipeIndex.js';
import { techniques, techniquesById, usedIn } from '../data/techniqueIndex.js';

const step = (technique) => ({ step: 'S', detail: 'd', ...(technique ? { technique } : {}) });
const rec = (id, ...techs) => ({ id, name: id, instructions: techs.map(step) });

describe('techniqueIdsOf', () => {
  it('collects the ids a recipe names, deduplicated, in step order', () => {
    expect(techniqueIdsOf(rec('r', 'b', undefined, 'a', 'b'))).toEqual(['b', 'a']);
  });
  it('is empty without steps or without any technique', () => {
    expect(techniqueIdsOf(rec('r', undefined))).toEqual([]);
    expect(techniqueIdsOf({ id: 'x' })).toEqual([]);
    expect(techniqueIdsOf(null)).toEqual([]);
  });
});

describe('recipesUsingTechnique (the "Used in" lookup)', () => {
  const all = [rec('one', 'a'), rec('two'), rec('three', 'b', 'a'), rec('four', 'b')];
  it('returns the records with a step that references the id, in the order given', () => {
    expect(recipesUsingTechnique('a', all).map((r) => r.id)).toEqual(['one', 'three']);
    expect(recipesUsingTechnique('b', all).map((r) => r.id)).toEqual(['three', 'four']);
  });
  it('returns nothing for an id no step references', () => {
    expect(recipesUsingTechnique('c', all)).toEqual([]);
  });
  it('lists a record once even when several steps name the technique', () => {
    expect(recipesUsingTechnique('a', [rec('dup', 'a', 'a')])).toHaveLength(1);
  });
});

describe('techniquesOf', () => {
  it('maps a recipe\'s ids to technique objects in step order, skipping unknown ids', () => {
    const all = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
    expect(techniquesOf(rec('r', 'b', 'zzz', 'a'), all).map((t) => t.title)).toEqual(['B', 'A']);
  });
});

describe('the real data', () => {
  it('derives Used in from the raw catalog: carrots by Honey Carrots, cutlets by the shawarma breasts', () => {
    expect(usedIn('carrot-roll-cut').map((r) => r.id)).toEqual(['honey-carrots']);
    expect(usedIn('chicken-breast-cutlets').map((r) => r.id)).toEqual(['sheet-pan-chicken-shawarma-breasts']);
    // The records are the very objects findable by id and name.
    expect(usedIn('carrot-roll-cut')[0]).toBe(rawRecipes.find((r) => r.id === 'honey-carrots'));
  });

  it('every step technique in the catalog resolves to a technique', () => {
    for (const r of rawRecipes) {
      for (const id of techniqueIdsOf(r)) expect(techniquesById.has(id), `${r.id} -> ${id}`).toBe(true);
    }
  });

  it('technique ids are unique and techniques.json keeps its order', () => {
    const ids = techniques.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['chicken-breast-cutlets', 'carrot-roll-cut']);
  });

  it('Honey Carrots no longer carries a diagrams field and names its technique on the Cut step', () => {
    const honey = rawRecipes.find((r) => r.id === 'honey-carrots');
    expect('diagrams' in honey).toBe(false);
    expect(honey.instructions.find((s) => s.step === 'Cut').technique).toBe('carrot-roll-cut');
  });
});
