// @vitest-environment jsdom
// The full recipe page: tag pills above the title, times in the header facts,
// the "Make it a meal" block and the ingredient-line links to set members.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { displayRecipes } from '../../data/recipeIndex.js';
import { getEffectiveTags } from '../../utils/autoTags.js';
import { chipLabel } from '../RecipeCard/cardChips.js';
import { categoryOf } from '../../data/catalog.js';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import RecipePage from '../RecipePage/RecipePage.jsx';
import RecipeView from './RecipeView.jsx';

const byId = (id) => displayRecipes.find((r) => r.id === id);
const shawarma = byId('sheet-pan-chicken-shawarma-breasts');
const short = (a) => a.getAttribute('href').replace(/^.*\/r\//, '/r/');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const page = (recipe, props = {}) => render(
  <CookHistoryProvider><RecipePage recipe={recipe} onBackToList={() => {}} {...props} /></CookHistoryProvider>,
);

describe('tag pills', () => {
  it('puts the category first, then the tags as pills, dropping a tag that repeats the category', () => {
    page(shawarma);
    const row = screen.getByRole('group', { name: 'Category and tags' });
    expect(row.firstElementChild.textContent).toBe(categoryOf(shawarma).label);
    expect(row.firstElementChild.tagName).not.toBe('BUTTON');
    const effective = getEffectiveTags(shawarma);
    expect(effective).toContain('#middle-eastern');
    const buttons = within(row).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(effective.filter((t) => t !== '#middle-eastern').map(chipLabel));
    expect(buttons).not.toContain('Middle eastern');
    // The row sits above the title.
    expect(row.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('calls onTagClick with the tag, and has no bottom Tags section', () => {
    const onTagClick = vi.fn();
    page(shawarma, { onTagClick });
    const row = screen.getByRole('group', { name: 'Category and tags' });
    const first = within(row).getAllByRole('button')[0];
    fireEvent.click(first);
    expect(onTagClick).toHaveBeenCalledWith(getEffectiveTags(shawarma).filter((t) => t !== '#middle-eastern')[0]);
    expect(first.hasAttribute('data-print-hide')).toBe(true);
    expect(screen.queryByRole('region', { name: 'Tags' })).toBeNull();
  });
});

describe('header facts', () => {
  it('shows the times and the Plan ahead chip, with no ingredient or step counts', () => {
    const r = displayRecipes.find((x) => !x.is_blank && x.waitTime && x.prepTime && x.cookTime);
    expect(r, 'a timed recipe with a wait').toBeTruthy();
    render(<CookHistoryProvider><RecipeView recipe={r} headingLevel={1} /></CookHistoryProvider>);
    // The header only: the Ingredients and Method headings keep their own counts.
    const text = screen.getByRole('heading', { level: 1 }).closest('header').textContent;
    expect(text).toMatch(/hands-on/);
    expect(text).toMatch(/Plan ahead: /);
    expect(text).not.toMatch(/\d+ ingredients/);
    expect(text).not.toMatch(/\d+ steps/);
    expect(screen.getByRole('link', { name: 'Jump to method' })).toBeTruthy();
    expect(text).toMatch(/Source:/);
  });

  it('shows just Jump to method and Source for a recipe with no times', () => {
    const r = { ...shawarma, prepTime: undefined, cookTime: undefined, waitTime: undefined };
    render(<CookHistoryProvider><RecipeView recipe={r} headingLevel={1} /></CookHistoryProvider>);
    expect(document.body.textContent).not.toMatch(/hands-on|Plan ahead/);
    expect(screen.getByRole('link', { name: 'Jump to method' })).toBeTruthy();
  });
});

describe('Make it a meal', () => {
  it('lists the other three members of the shawarma set, in set order', () => {
    page(shawarma);
    const nav = screen.getByRole('navigation', { name: 'Shawarma wrap night' });
    expect(within(nav).getByRole('heading', { level: 2, name: 'Make it a meal' })).toBeTruthy();
    expect(nav.textContent).toContain('Shawarma wrap night · 4 recipes made to go together');
    expect(within(nav).getAllByRole('link').map(short)).toEqual([
      '/r/quinoa/', '/r/smashed-spiced-cucumbers-mint/', '/r/quick-pickled-red-onions/',
    ]);
  });

  it('navigates through onViewRelated on a plain click', () => {
    const onViewRelated = vi.fn();
    page(shawarma, { onViewRelated });
    const nav = screen.getByRole('navigation', { name: 'Shawarma wrap night' });
    fireEvent.click(within(nav).getAllByRole('link')[0]);
    expect(onViewRelated).toHaveBeenCalledWith(expect.objectContaining({ id: 'quinoa' }));
  });

  it('is absent on a recipe in no set, and in the modal frame', () => {
    page(byId('lasagna'));
    expect(screen.queryByText('Make it a meal')).toBeNull();
    cleanup();
    render(<CookHistoryProvider><RecipeView recipe={shawarma} headingLevel={2} /></CookHistoryProvider>);
    expect(screen.queryByText('Make it a meal')).toBeNull();
  });
});

describe('ingredient-line links', () => {
  it('links the set members named in the shawarma ingredients and leaves the rest plain', () => {
    page(shawarma);
    const links = within(screen.getByRole('region', { name: /ingredients/i })).getAllByRole('link');
    expect(links.map(short)).toEqual(['/r/smashed-spiced-cucumbers-mint/', '/r/quick-pickled-red-onions/']);
    expect(links[0].textContent).toBe('Smashed Spiced Cucumbers with Mint');
    expect(links[0].closest('label').textContent).toBe('Smashed Spiced Cucumbers with Mint, drained');
  });

  it('shows no links on a recipe in no set', () => {
    page(byId('lasagna'));
    expect(within(screen.getByRole('region', { name: /ingredients/i })).queryAllByRole('link')).toEqual([]);
  });

  it('opens the linked recipe through onViewRecipe on a plain click', () => {
    const onViewRelated = vi.fn();
    page(shawarma, { onViewRelated });
    fireEvent.click(within(screen.getByRole('region', { name: /ingredients/i })).getAllByRole('link')[1]);
    expect(onViewRelated).toHaveBeenCalledWith(expect.objectContaining({ id: 'quick-pickled-red-onions' }));
  });
});
