// @vitest-environment jsdom
// The Chef's Drafts page lists every draft, as the normal card with its draft
// label, under the one-line explainer - and nothing from the Cookbook.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import { displayRecipes } from '../../data/recipeIndex.js';
import { DRAFT_LABEL, DRAFTS_INTRO, isDraft } from '../../data/sections.js';
import { recipePath } from '../../utils/recipeRoute.js';
import DraftsPage from './DraftsPage.jsx';

const drafts = displayRecipes.filter((r) => isDraft(r) && !r.is_blank);
const renderPage = (onViewRecipe = () => {}) => render(
  <CookHistoryProvider><DraftsPage onViewRecipe={onViewRecipe} /></CookHistoryProvider>,
);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('DraftsPage', () => {
  it('has at least one draft to test against', () => {
    expect(drafts.length).toBeGreaterThan(0);
  });

  it("puts the explainer directly under the Chef's Drafts heading", () => {
    renderPage();
    const h1 = screen.getByRole('heading', { level: 1, name: /Chef's Drafts/ });
    expect(h1.nextElementSibling.textContent).toBe(DRAFTS_INTRO);
  });

  it('lists every draft and nothing else, each linked to its own page and labelled', () => {
    renderPage();
    const links = within(screen.getByRole('main')).getAllByRole('link');
    expect(links.map((a) => a.textContent).sort()).toEqual(drafts.map((r) => r.name).sort());
    for (const r of drafts) {
      expect(screen.getByRole('link', { name: r.name }).getAttribute('href')).toBe(recipePath(r.id));
    }
    expect(screen.getAllByText(DRAFT_LABEL)).toHaveLength(drafts.length);
  });

  it('opens a draft when its card is clicked', async () => {
    const user = userEvent.setup();
    const onViewRecipe = vi.fn();
    renderPage(onViewRecipe);
    await user.click(screen.getByRole('link', { name: drafts[0].name }));
    expect(onViewRecipe).toHaveBeenCalledTimes(1);
    expect(onViewRecipe.mock.calls[0][0].id).toBe(drafts[0].id);
  });
});
