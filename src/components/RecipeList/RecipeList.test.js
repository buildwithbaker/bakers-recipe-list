// Written without JSX: the suite only collects *.test.js.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import RecipeList from './RecipeList.jsx';

const render = () => renderToString(createElement(RecipeList, {
  onViewRecipe: () => {}, searchQuery: '', onSearch: () => {},
  category: '', onCategoryChange: () => {},
}));

// The chip row's buttons, in order, as their visible text.
function chipRow(html) {
  const row = html.match(/aria-label="Categories and filters">([\s\S]*?)<\/div>/)[1];
  return [...row.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\d+$/, '').trim());
}

describe('category chip row', () => {
  it('leads with Filters and ends with Surprise me', () => {
    const chips = chipRow(render());
    expect(chips[0]).toBe('Filters');
    expect(chips[1]).toBe('All');
    expect(chips.at(-1)).toBe('Surprise me');
  });

  it('keeps the Filters button a dialog opener with a pressed state', () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-pressed="false"[^>]*>.*?Filters/);
  });

  // The Cookbook / For Review / To Try switcher was removed on 2026-10-02.
  it('renders no collection switcher', () => {
    const html = render();
    expect(html).not.toMatch(/aria-label="Collections"/);
    expect(html).not.toMatch(/For Review|To Try/);
  });
});
