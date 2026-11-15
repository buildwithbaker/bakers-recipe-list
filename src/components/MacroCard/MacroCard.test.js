// Written without JSX: the suite collects *.test.js under node.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import MacroCard from './MacroCard.jsx';

const html = (props) => renderToString(createElement(MacroCard, props)).replace(/<!-- -->/g, '');
const perServing = { calories: 300, protein: 20, fat: 10, carbs: 30, fiber: 3 };
const ok = (extra = {}) => html({ status: 'ok', perServing, excluded: [], counted: 5, ...extra });

describe('MacroCard title', () => {
  it('says per serving by default', () => {
    expect(ok()).toContain('Estimated Nutrition (per serving)');
  });

  it.each(['patty', 'sandwich', 'square', 'ball', 'smoothie'])('names the authored unit: per %s', (unit) => {
    expect(ok({ unit })).toContain(`Estimated Nutrition (per ${unit})`);
  });
});

describe('MacroCard statuses', () => {
  it('ok shows the numbers and the USDA footer, with no match-count line', () => {
    const out = ok();
    expect(out).toContain('300');
    expect(out).toContain('20g');
    expect(out).toContain('Estimated from USDA FoodData Central · Not dietitian-verified');
    expect(out).not.toMatch(/ingredients matched/);
    expect(out).not.toContain('Not counted');
  });

  it('lists excluded lines in a closed "Not counted (N)" disclosure', () => {
    const out = ok({ excluded: [{ text: 'water, as needed', reason: 'no calories' }, { text: 'salt', reason: 'negligible' }] });
    expect(out).toContain('Not counted (2)');
    expect(out).toContain('water, as needed');
    expect(out).toContain('no calories');
    expect(out).not.toMatch(/<details[^>]*\sopen/);
  });

  it('skipped says not estimated, with the reason', () => {
    const out = html({ status: 'skipped', reason: 'Marinade is discarded.' });
    expect(out).toContain('Nutrition not estimated');
    expect(out).toContain('Marinade is discarded.');
  });

  it('incomplete never shows partial numbers', () => {
    const out = html({ status: 'incomplete', missing: ['a', 'b', 'c'], perServing });
    expect(out).toContain('Nutrition unavailable: 3 ingredient lines are not mapped');
    expect(out).not.toContain('300');
  });

  it('none renders nothing', () => {
    expect(html({ status: 'none' })).toBe('');
  });
});
