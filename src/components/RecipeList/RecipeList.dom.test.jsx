// @vitest-environment jsdom
// The list as a person uses it: cards are links, search narrows them, Filters
// opens its sheet, a card opens its recipe and the star pins without opening.
import { useState } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import { LISTED_ROWS } from '../../data/catalog.js';
import { recipePath } from '../../utils/recipeRoute.js';
import { DRAFTS_INTRO } from '../../data/sections.js';
import SearchBar from '../SearchBar/SearchBar.jsx';
import RecipeList from './RecipeList.jsx';

// The list and the search box share one query, the way App wires them.
function ListWithSearch({ onViewRecipe }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  return (
    <CookHistoryProvider>
      <SearchBar value={query} onChange={setQuery} />
      <RecipeList
        onViewRecipe={onViewRecipe}
        searchQuery={query}
        onSearch={setQuery}
        category={category}
        onCategoryChange={setCategory}
      />
    </CookHistoryProvider>
  );
}

const cardLinks = () => within(screen.getByRole('main')).getAllByRole('link');

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('RecipeList', () => {
  it('renders every written recipe as a link to its page', () => {
    render(<ListWithSearch onViewRecipe={() => {}} />);
    const links = cardLinks();
    expect(links).toHaveLength(LISTED_ROWS.length);
    const lasagna = screen.getByRole('link', { name: 'Lasagna' });
    expect(lasagna.getAttribute('href')).toBe(recipePath('lasagna'));
  });

  it('narrows the list as you type in search', async () => {
    const user = userEvent.setup();
    render(<ListWithSearch onViewRecipe={() => {}} />);
    await user.type(screen.getByRole('searchbox'), 'lasagna');
    await screen.findByText(/1 result for/);
    expect(cardLinks().map((a) => a.textContent)).toEqual(['Lasagna']);
  });

  it('puts Filters first in the chip row, and it opens the Filters dialog', async () => {
    const user = userEvent.setup();
    render(<ListWithSearch onViewRecipe={() => {}} />);
    const row = screen.getByRole('group', { name: 'Categories and filters' });
    const [first] = within(row).getAllByRole('button');
    expect(first).toBe(within(row).getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull();
    await user.click(first);
    screen.getByRole('dialog', { name: 'Filters' });
  });

  it('opens a recipe when you click its card', async () => {
    const user = userEvent.setup();
    const onViewRecipe = vi.fn();
    render(<ListWithSearch onViewRecipe={onViewRecipe} />);
    await user.click(screen.getByRole('link', { name: 'Lasagna' }));
    expect(onViewRecipe).toHaveBeenCalledTimes(1);
    expect(onViewRecipe.mock.calls[0][0]).toMatchObject({ id: 'lasagna', name: 'Lasagna' });
  });

  it('pins and unpins with the star, without opening the recipe', async () => {
    const user = userEvent.setup();
    const onViewRecipe = vi.fn();
    render(<ListWithSearch onViewRecipe={onViewRecipe} />);
    const star = () => screen.getByRole('button', { name: 'Pin Lasagna' });
    expect(star().getAttribute('aria-pressed')).toBe('false');
    await user.click(star());
    expect(star().getAttribute('aria-pressed')).toBe('true');
    await user.click(star());
    expect(star().getAttribute('aria-pressed')).toBe('false');
    expect(onViewRecipe).not.toHaveBeenCalled();
  });
});

describe("RecipeList: Chef's Drafts", () => {
  it('lists the drafts last, under their own heading with the explainer, each card labelled', () => {
    render(<ListWithSearch onViewRecipe={() => {}} />);
    const headings = within(screen.getByRole('main')).getAllByRole('heading', { level: 2 }).map((h) => h.id);
    expect(headings.at(-1)).toBe('g-chefs-drafts');
    const group = screen.getByRole('region', { name: /Chef's Drafts/ });
    expect(within(group).getByText(DRAFTS_INTRO)).toBeTruthy();
    const drafts = LISTED_ROWS.filter((r) => r.section === 'CHEFS DRAFTS');
    expect(drafts.length).toBeGreaterThan(0);
    expect(within(group).getAllByText('Draft - not cooked yet')).toHaveLength(drafts.length);
  });

  it('shows the explainer under no other heading', () => {
    render(<ListWithSearch onViewRecipe={() => {}} />);
    expect(screen.getAllByText(DRAFTS_INTRO)).toHaveLength(1);
  });
});
