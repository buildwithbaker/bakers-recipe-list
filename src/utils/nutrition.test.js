import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { computeMacros, validateNutrition } from './nutrition.js';
import recipes from '../data/recipes.json';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/nutrition/${f}`, import.meta.url), 'utf8'));
const FOODS = read('foods.json').foods;
const LINES = read('lines.json').recipes;

describe('validateNutrition on the real data', () => {
  it('returns no problems for recipes.json + foods.json + lines.json', () => {
    expect(validateNutrition(recipes, FOODS, LINES)).toEqual([]);
  });

  it('flags both the new text and the old one when an ingredient line is edited', () => {
    const id = Object.keys(LINES).find((k) => LINES[k].lines);
    const recipe = recipes.find((r) => r.id === id);
    const idx = recipe.ingredients.findIndex((i) => i.type === 'item');
    const old = recipe.ingredients[idx].text;
    const edited = recipes.map((r) => (r.id !== id ? r : {
      ...r,
      ingredients: r.ingredients.map((i, n) => (n === idx ? { ...i, text: `${old} (edited)` } : i)),
    }));
    const problems = validateNutrition(edited, FOODS, LINES);
    expect(problems.some((p) => p.includes('line not mapped') && p.includes('(edited)'))).toBe(true);
    expect(problems.some((p) => p.includes('no longer has') && p.includes(old))).toBe(true);
  });
});

describe('computeMacros', () => {
  const foods = {
    flour: { fdcId: 1, per100g: { kcal: 400, protein: 10, fat: 2, carbs: 80, fiber: 4 } },
    bacon: { fdcId: 2, per100g: { kcal: 500, protein: 20, fat: 40, carbs: 0, fiber: 0 } },
  };
  const item = (text) => ({ type: 'item', text });
  const recipe = {
    id: 'r', section: 'AMERICAN',
    ingredients: [{ type: 'header', text: 'Dry' }, item('flour'), item('bacon'), item('water')],
  };
  const lines = {
    r: { lines: {
      flour: { food: 'flour', grams: 200, retain: 0.5 },
      bacon: { food: 'bacon', grams: 100, fatRetain: 0.25 },
      water: { exclude: 'no calories' },
    } },
  };

  it('applies retain, fatRetain (minus 9 kcal/g) and excluded lines', () => {
    // flour: k=1 -> 400 kcal, 10 p, 2 f, 80 c, 4 fib
    // bacon: k=1, fatKept=10 -> 500 - 30*9 = 230 kcal, 20 p, 10 f
    const r = computeMacros(recipe, 2, foods, lines);
    expect(r.status).toBe('ok');
    expect(r.perServing).toEqual({ calories: 315, protein: 15, fat: 6, carbs: 40, fiber: 2 });
    expect(r.excluded).toEqual([{ text: 'water', reason: 'no calories' }]);
    expect(r.counted).toBe(2);
  });

  it('is incomplete, with no numbers, when a line is unmapped', () => {
    const r = computeMacros(recipe, 2, foods, { r: { lines: { flour: lines.r.lines.flour } } });
    expect(r.status).toBe('incomplete');
    expect(r.missing).toEqual(['bacon', 'water']);
    expect(r.perServing).toBeUndefined();
  });

  it('returns skipped with the reason for a recipe-level skip', () => {
    expect(computeMacros(recipe, 2, foods, { r: { skip: 'Marinade is discarded.' } }))
      .toEqual({ status: 'skipped', reason: 'Marinade is discarded.' });
  });

  it('returns none for blanks, no-macro sections and missing servings', () => {
    expect(computeMacros({ ...recipe, is_blank: true }, 2, foods, lines).status).toBe('none');
    expect(computeMacros({ ...recipe, section: 'DOUGHS' }, 2, foods, lines).status).toBe('none');
    expect(computeMacros(recipe, undefined, foods, lines).status).toBe('none');
  });
});
