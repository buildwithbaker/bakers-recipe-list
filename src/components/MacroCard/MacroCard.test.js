// Written without JSX: the suite collects *.test.js under node.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import MacroCard from './MacroCard.jsx';

const done = (unit) => renderToString(createElement(MacroCard, {
  status: 'done', matchedCount: 5, totalCount: 5, unit,
  macros: { calories: 300, protein: 20, fat: 10, carbs: 30, fiber: 3 },
})).replace(/<!-- -->/g, '');

describe('MacroCard title', () => {
  it('says per serving by default', () => {
    expect(done(undefined)).toContain('Estimated Nutrition (per serving)');
  });

  it.each(['patty', 'sandwich', 'square', 'ball', 'smoothie'])('names the authored unit: per %s', (unit) => {
    expect(done(unit)).toContain(`Estimated Nutrition (per ${unit})`);
  });
});
