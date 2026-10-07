import { describe, it, expect } from 'vitest';
import recipes from '../data/recipes.json';
import { isAmountParenthetical, stripStepAmounts } from './stepAmounts.js';

const published = recipes.filter((r) => !r.is_blank);
const stepTexts = published.flatMap((r) =>
  r.instructions.flatMap((s) => [s.step, s.detail].filter(Boolean).map((text) => ({ id: r.id, text }))),
);
const parentheticals = (text) => [...text.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
const byId = (id) => published.find((r) => r.id === id);

describe('stripStepAmounts', () => {
  it('knows an amount from an aside', () => {
    for (const c of ['1 tsp', '½ to 1 tsp', '2, sliced', 'about ½ cup', 'scant ¾ cup', 'up to ¼ cup',
      'pinch', 'a pinch of salt', 'start with ¼ tsp', 'from 4 cloves', 'About 2 cups']) {
      expect(isAmountParenthetical(c), c).toBe(true);
    }
    for (const c of ['optional', 'make ahead', 'stovetop, no oven', 'keep the marinade',
      '5-6 hr Ahead', '4-5 min max', 'around the 4-hour mark']) {
      expect(isAmountParenthetical(c), c).toBe(false);
    }
  });

  it('leaves no amount parenthetical in any published step', () => {
    const survivors = stepTexts.flatMap(({ id, text }) =>
      parentheticals(stripStepAmounts(text)).filter(isAmountParenthetical).map((c) => `${id}: (${c})`),
    );
    expect(survivors).toEqual([]);
  });

  it('keeps every other parenthetical in every published step', () => {
    let kept = 0;
    for (const { id, text } of stepTexts) {
      const out = stripStepAmounts(text);
      for (const c of parentheticals(text).filter((p) => !isAmountParenthetical(p))) {
        expect(out, id).toContain(`(${c})`);
        kept += 1;
      }
    }
    // The catalog really does carry asides, so the loop above checked something.
    expect(kept).toBeGreaterThan(5);
  });

  it('leaves no doubled space or space before punctuation', () => {
    for (const { id, text } of stepTexts) {
      const out = stripStepAmounts(text);
      expect(out, id).not.toMatch(/ {2}/);
      expect(out, id).not.toMatch(/ [,.;:!?]/);
    }
  });

  it('changes text only where it held an amount', () => {
    expect(stripStepAmounts('Heat the oven to 425°F.')).toBe('Heat the oven to 425°F.');
    expect(stripStepAmounts('')).toBe('');
  });

  it('spot-check: the pilot seasoning step', () => {
    expect(stripStepAmounts(byId('sheet-pan-paprika-chicken-thighs-with-potatoes').instructions[1].detail)).toBe(
      'In a small bowl, stir together the smoked paprika, garlic powder, dried oregano, cayenne, table salt, and black pepper.',
    );
  });

  it('spot-check: a duration in a step title stays', () => {
    expect(stripStepAmounts(byId('soy-garlic-paprika-drumsticks').instructions[0].step)).toBe('Dry Brine (5-6 hr Ahead)');
  });

  it('spot-check: asides stay while the amounts beside them go', () => {
    const steps = byId('seared-chicken-breast-with-cranberry-thyme-pan-sauce').instructions;
    expect(stripStepAmounts(steps[0].step)).toBe('Soak the sauce base (make ahead)');
    expect(stripStepAmounts(steps[2].step)).toBe('Sear (stovetop, no oven)');
  });
});
