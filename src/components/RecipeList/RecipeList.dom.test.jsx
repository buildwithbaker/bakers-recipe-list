// @vitest-environment jsdom
// The list as a person uses it: cards are links, search narrows them, Filters
// opens its sheet, a card opens its recipe and the star pins without opening.
// Chef's Drafts never appear here; a footer link is the one way to them.
import { useState } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import { LISTED_ROWS } from '../../data/catalog.js';
import { displayRecipes } from '../../data/recipeIndex.js';
import { draftsPath, recipePath } from '../../utils/recipeRoute.js';
import { DRAFT_LABEL, DRAFTS_INTRO, isDraft } from '../../data/sections.js';
import SearchBar from '../SearchBar/SearchBar.jsx';
import RecipeList from './RecipeList.jsx';

// The list and the search box share one query, the way App wires them.
function ListWithSearch({ onViewRecipe, onOpenDrafts }) {
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
        onOpenDrafts={onOpenDrafts}
      />
    </CookHistoryProvider>
  );
}

// Recipe cards only: the Chef's Drafts footer link is not a card.
const cardLinks = () => within(screen.getByRole('main')).getAllByRole('link').filter((a) => !a.closest('footer'));
const drafts = displayRecipes.filter((r) => isDraft(r) && !r.is_blank);

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
  it('has at least one draft to test against', () => {
    expect(drafts.length).toBeGreaterThan(0);
  });

  it('never lists a draft: no card, no heading, no chip, no label, no explainer', () => {
    render(<ListWithSearch onViewRecipe={() => {}} />);
    const main = screen.getByRole('main');
    for (const d of drafts) expect(within(main).queryByRole('link', { name: d.name })).toBeNull();
    expect(document.getElementById('g-chefs-drafts')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Categories and filters' })).queryByRole('button', { name: /Chef's Drafts/ })).toBeNull();
    expect(screen.queryByText(DRAFT_LABEL)).toBeNull();
    expect(screen.queryByText(DRAFTS_INTRO)).toBeNull();
  });

  it('never returns a draft in search results, even searched by its exact name', async () => {
    render(<ListWithSearch onViewRecipe={() => {}} />);
    for (const d of drafts) {
      // One change event per draft: typing the name key by key made the test
      // grow with the number of drafts and time out.
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: d.name } });
      await screen.findByRole('status');
      expect(screen.queryByRole('link', { name: d.name })).toBeNull();
      expect(screen.queryByText(DRAFT_LABEL)).toBeNull();
    }
  });

  it('ends with a quiet "Chef\'s Drafts" footer link to /drafts/, after the last section', () => {
    render(<ListWithSearch onViewRecipe={() => {}} />);
    const link = screen.getByRole('link', { name: "Chef's Drafts" });
    expect(link.getAttribute('href')).toBe(draftsPath());
    const footer = link.closest('footer');
    expect(footer).toBeTruthy();
    const sections = screen.getByRole('main').querySelectorAll('section');
    // Nothing that lists recipes comes after it.
    expect(sections[sections.length - 1].compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the Drafts page when the footer link is clicked', async () => {
    const user = userEvent.setup();
    const onOpenDrafts = vi.fn();
    render(<ListWithSearch onViewRecipe={() => {}} onOpenDrafts={onOpenDrafts} />);
    await user.click(screen.getByRole('link', { name: "Chef's Drafts" }));
    expect(onOpenDrafts).toHaveBeenCalledTimes(1);
  });
});
