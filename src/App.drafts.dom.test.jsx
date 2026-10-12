// @vitest-environment jsdom
// Chef's Drafts against real (jsdom) history: the footer link pushes /drafts/
// like About, a draft opened there is a full page that Back returns from, and
// a draft still opens by direct link and by ?recipe=. vitest's BASE_URL is '/'.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App.jsx';
import { displayRecipes } from './data/recipeIndex.js';
import { DRAFT_LABEL, isDraft } from './data/sections.js';
import { recipePath } from './utils/recipeRoute.js';

const draft = displayRecipes.find((r) => isDraft(r) && !r.is_blank);
const footerLink = () => screen.getByRole('link', { name: "Chef's Drafts" });

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

describe("Chef's Drafts page", () => {
  it('is linked from the footer only: not the tab bars, not the masthead', () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
    render(<App />);
    expect(footerLink().closest('footer')).toBeTruthy();
    for (const nav of screen.getAllByRole('navigation')) {
      expect(within(nav).queryByText(/Chef's Drafts/)).toBeNull();
    }
    expect(within(screen.getByRole('banner')).queryByText(/Chef's Drafts/)).toBeNull();
  });

  it('the footer link opens /drafts/ on a new history entry, and Back returns to the list', async () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
    render(<App />);
    const before = window.history.length;
    fireEvent.click(footerLink());
    expect(window.location.pathname).toBe('/drafts/');
    expect(window.history.length).toBe(before + 1);
    screen.getByRole('heading', { level: 1, name: /Chef's Drafts/ });
    expect(screen.getByRole('link', { name: draft.name })).toBeTruthy();

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: /Chef's Drafts/ })).toBeNull());
    expect(screen.queryByRole('link', { name: draft.name })).toBeNull();
  });

  it('opens a draft from the Drafts page as a full page, and Back returns to the Drafts page', async () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
    render(<App />);
    fireEvent.click(footerLink());
    fireEvent.click(screen.getByRole('link', { name: draft.name }));
    expect(window.location.pathname).toBe(recipePath(draft.id));
    screen.getByRole('heading', { level: 1, name: draft.name });
    expect(screen.getByText(DRAFT_LABEL)).toBeTruthy();

    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/drafts/'));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: /Chef's Drafts/ }));
  });

  it('a direct load of /drafts/ shows the page', () => {
    window.history.replaceState(null, '', '/drafts/');
    render(<App />);
    screen.getByRole('heading', { level: 1, name: /Chef's Drafts/ });
  });

  it('a draft still opens by its own path, with its label', () => {
    window.history.replaceState(null, '', recipePath(draft.id));
    render(<App />);
    screen.getByRole('heading', { level: 1, name: draft.name });
    expect(screen.getByText(DRAFT_LABEL)).toBeTruthy();
  });

  it('a draft still opens by ?recipe=, with its label', () => {
    window.history.replaceState(null, '', `/?recipe=${encodeURIComponent(draft.name)}`);
    render(<App />);
    screen.getByRole('heading', { level: 1, name: draft.name });
    expect(screen.getByText(DRAFT_LABEL)).toBeTruthy();
    expect(window.location.pathname).toBe(recipePath(draft.id));
  });
});
