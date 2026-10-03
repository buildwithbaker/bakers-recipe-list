// Written without JSX: the suite only collects *.test.js.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { COLL_BOOK, COLL_TRY } from '../../data/catalog.js';
import RecipeList from './RecipeList.jsx';

const render = (collection) => renderToString(createElement(RecipeList, {
  onViewRecipe: () => {}, searchQuery: '', onSearch: () => {},
  collection, onCollectionChange: () => {}, category: '', onCategoryChange: () => {},
}));

// The chip row's buttons, in order, as their visible text.
function chipRow(html) {
  const row = html.match(/aria-label="Categories and filters">([\s\S]*?)<\/div>/)[1];
  return [...row.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\d+$/, '').trim());
}

describe('category chip row', () => {
  it('leads with Filters and ends with Surprise me', () => {
    const chips = chipRow(render(COLL_BOOK));
    expect(chips[0]).toBe('Filters');
    expect(chips[1]).toBe('All');
    expect(chips.at(-1)).toBe('Surprise me');
  });

  it('keeps the Filters button a dialog opener with a pressed state', () => {
    const html = render(COLL_BOOK);
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-pressed="false"[^>]*>.*?Filters/);
  });

  it('has no Filters or Surprise me in To Try, so All leads', () => {
    const chips = chipRow(render(COLL_TRY));
    expect(chips[0]).toBe('All');
    expect(chips).not.toContain('Filters');
    expect(chips).not.toContain('Surprise me');
  });
});
