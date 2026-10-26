// @vitest-environment jsdom
// SearchResults tells each card why it matched: `matchedLine` is the first
// matching ingredient line, "tag #x", "source: x" or "category: x", and
// nothing for a name hit. RecipeCard is stubbed here to read the prop; how a
// card shows it is RecipeCard's business.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SEARCH_MODES } from '../../utils/search.js';
import SearchResults from './SearchResults.jsx';
import { SearchModeContext } from './searchModeContext.js';

vi.mock('../RecipeCard/RecipeCard.jsx', () => ({
  default: ({ recipe, matchedLine }) => (
    <li data-testid="card" data-name={recipe.name} data-line={matchedLine === undefined ? '(none)' : matchedLine} />
  ),
}));

afterEach(cleanup);

function linesFor(query, mode) {
  render(
    <SearchModeContext.Provider value={mode}>
      <SearchResults query={query} onViewRecipe={() => {}} onClear={() => {}} />
    </SearchModeContext.Provider>,
  );
  return new Map(screen.getAllByTestId('card').map((li) => [li.dataset.name, li.dataset.line]));
}

describe('SearchResults: matchedLine', () => {
  it('an ingredient hit passes the first matching line', () => {
    const got = linesFor('red onion', SEARCH_MODES.INGREDIENT);
    expect(got.get('Persian Chicken')).toBe('1 red onion, chopped');
    expect(got.get('Quick Pickled Red Onions')).toBe('1 large red onion (about ¾ lb)');
  });

  it('a name hit passes nothing', () => {
    const got = linesFor('red onion', SEARCH_MODES.ALL);
    expect(got.get('Quick Pickled Red Onions')).toBe('(none)');
    expect(got.get('Persian Chicken')).toBe('1 red onion, chopped');
  });

  it('a tag, source or category hit says which', () => {
    expect([...linesFor('#middle-eastern', SEARCH_MODES.ALL).values()]).toContain('tag #middle-eastern');
    cleanup();
    expect([...linesFor('slow cooker', SEARCH_MODES.ALL).values()]).toContain('category: Slow Cooker');
  });
});
