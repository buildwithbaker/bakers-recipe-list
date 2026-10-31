// @vitest-environment jsdom
// Search as a person uses it: the Name / Ingredient / All toggle beside the
// box (App owns the mode; a tag click puts it back to All; it never reaches
// the URL), and Chef's Drafts turning up in results with their draft pill.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../App.jsx';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import { DRAFT_ROWS } from '../../data/catalog.js';
import { DRAFT_LABEL } from '../../data/sections.js';
import { SEARCH_MODES } from '../../utils/search.js';
import SearchResults from './SearchResults.jsx';
import { SearchModeContext } from './searchModeContext.js';

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const modeGroup = () => screen.getByRole('group', { name: 'Search in' });
const modeButton = (name) => within(modeGroup()).getByRole('button', { name });
const resultNames = () => within(screen.getAllByRole('list')[0]).getAllByRole('link').map((a) => a.textContent);
const search = (value) => fireEvent.change(screen.getByRole('searchbox'), { target: { value } });

describe('search mode toggle', () => {
  beforeEach(() => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
  });

  it('offers Name, Ingredient and All beside the box, All pressed by default', () => {
    render(<App />);
    const buttons = within(modeGroup()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Name', 'Ingredient', 'All']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
  });

  it('switches what the query is matched against, and keeps the mode out of the URL', async () => {
    render(<App />);
    search('onion');
    await screen.findByText(/results? for “onion”$/);
    // Spicy Pork Patties has onion only as onion powder.
    expect(resultNames()).toContain('Spicy Pork Patties');

    fireEvent.click(modeButton('Ingredient'));
    expect(modeButton('Ingredient').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton('All').getAttribute('aria-pressed')).toBe('false');
    await screen.findByText(/results? for “onion” in ingredients/);
    expect(resultNames()).not.toContain('Spicy Pork Patties');
    expect(resultNames()).toContain('Persian Chicken');

    fireEvent.click(modeButton('Name'));
    await screen.findByText(/results? for “onion” in names/);
    expect(resultNames()).toContain('Quick Pickled Red Onions');
    expect(resultNames()).not.toContain('Persian Chicken');

    expect(window.location.search).toBe('?q=onion');
  });

  it('says which field it searched when nothing matches', async () => {
    render(<App />);
    fireEvent.click(modeButton('Name'));
    search('cloves');
    await screen.findByText('No match for “cloves” in names');
    screen.getByText('Searching recipe names only.');
  });

  it('goes back to All when a tag is clicked', async () => {
    render(<App />);
    fireEvent.click(modeButton('Ingredient'));
    expect(modeButton('Ingredient').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('link', { name: 'Lasagna' }));
    const dialog = await screen.findByRole('dialog');
    const tag = within(within(dialog).getByRole('region', { name: 'Tags' })).getAllByRole('button')[0];
    const tagText = tag.textContent;
    fireEvent.click(tag);
    await waitFor(() => expect(screen.getByRole('searchbox').value).toBe(tagText));
    expect(modeButton('All').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton('Ingredient').getAttribute('aria-pressed')).toBe('false');
  });
});

describe("search results: Chef's Drafts", () => {
  const draft = DRAFT_ROWS[0];

  it('a draft is found, and its card wears the draft pill', () => {
    expect(draft).toBeTruthy();
    render(
      <CookHistoryProvider>
        <SearchModeContext.Provider value={SEARCH_MODES.NAME}>
          <SearchResults query={draft.name} onViewRecipe={() => {}} onClear={() => {}} />
        </SearchModeContext.Provider>
      </CookHistoryProvider>,
    );
    const card = screen.getByRole('link', { name: draft.name }).closest('li');
    expect(within(card).getByText(DRAFT_LABEL)).toBeTruthy();
  });

  it('"red onion" in the app lists the 2 drafts that use it, each with its pill', async () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
    render(<App />);
    search('red onion');
    await screen.findByText('4 results for “red onion”');
    for (const name of ['Sheet Pan Chicken Shawarma Thighs', 'California Burgers with Special Sauce']) {
      const card = screen.getByRole('link', { name: new RegExp(name) }).closest('li');
      expect(within(card).getByText(DRAFT_LABEL)).toBeTruthy();
    }
    // Persian Chicken is Cookbook; Quick Pickled Red Onions graduated 2026-10-31.
    for (const name of ['Persian Chicken', 'Quick Pickled Red Onions']) {
      const card = screen.getByRole('link', { name: new RegExp(name) }).closest('li');
      expect(within(card).queryByText(DRAFT_LABEL)).toBeNull();
    }
  });
});
