// @vitest-environment jsdom
// The Chef's Drafts page lists every draft, as the normal card with its draft
// label, under the one-line explainer - and nothing from the Cookbook.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import { categoryOf } from '../../data/catalog.js';
import { displayRecipes } from '../../data/recipeIndex.js';
import {
  DRAFT_LABEL, DRAFTS_INTRO, PLANNED_INTRO, PLANNED_LABEL, isDraft,
} from '../../data/sections.js';
import { recipePath } from '../../utils/recipeRoute.js';
import DraftsPage from './DraftsPage.jsx';

const drafts = displayRecipes.filter((r) => isDraft(r) && !r.is_blank);
const planned = displayRecipes.filter((r) => !isDraft(r) && r.is_blank);
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

  it('shows every placeholder under Planned, after the drafts, as a card that is not a link', () => {
    renderPage();
    expect(planned.length).toBeGreaterThan(0);
    const h2 = screen.getByRole('heading', { level: 2, name: /Planned/ });
    expect(h2.textContent).toBe(`Planned${planned.length}`);
    expect(h2.nextElementSibling.textContent).toBe(PLANNED_INTRO);
    const section = h2.closest('section');
    expect(within(section).queryAllByRole('link')).toHaveLength(0);
    expect(within(section).getAllByText(PLANNED_LABEL)).toHaveLength(planned.length);
    for (const r of planned) expect(within(section).getByText(r.name, { selector: 'span' })).toBeTruthy();
    // The drafts grid comes first in the page.
    const grid = screen.getByRole('link', { name: drafts[0].name }).closest('ul');
    expect(grid.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('groups Planned by category, each heading counting its own cards', () => {
    renderPage();
    const section = screen.getByRole('heading', { level: 2, name: /Planned/ }).closest('section');
    const want = new Map();
    for (const r of planned) {
      const label = categoryOf(r).label;
      want.set(label, (want.get(label) ?? 0) + 1);
    }
    const got = within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(got.sort()).toEqual([...want].map(([l, n]) => `${l}${n}`).sort());
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
