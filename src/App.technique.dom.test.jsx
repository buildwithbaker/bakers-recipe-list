// @vitest-environment jsdom
// The technique popup and the Learning to Cook page inside the whole app, with
// App's own history handling listening: on the recipe PAGE and over the list
// (the card). Back must close the popup and leave the reader on the recipe;
// the popup's link must reach Learning to Cook with Back returning to the
// recipe, popup closed. vitest's BASE_URL is '/'.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App.jsx';

const trigger = () => screen.getByRole('button', { name: 'How to: Roll-cutting carrots' });
const popup = () => screen.queryByRole('dialog', { name: 'Roll-cutting carrots' });
const goBack = async () => { await act(async () => { window.history.back(); }); };

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

describe.each([
  ['the recipe page', true, 1],
  ['the recipe card over the list', false, 2],
])('technique popup on %s', (_label, page, level) => {
  const mount = () => {
    window.history.replaceState({ overlays: [], page, tab: 'recipes' }, '', '/r/honey-carrots/');
    render(<App />);
  };
  const recipeHeading = () => screen.getByRole('heading', { level, name: 'Honey Carrots' });

  it('Back closes the popup, leaving the recipe open at the same address', async () => {
    mount();
    fireEvent.click(trigger());
    expect(popup()).toBeTruthy();
    await goBack();
    await waitFor(() => expect(popup()).toBeNull());
    expect(window.location.pathname).toBe('/r/honey-carrots/');
    expect(recipeHeading()).toBeTruthy();
    expect(window.history.state).toMatchObject({ page });
    expect(window.history.state.technique).toBeUndefined();
  });

  it('Escape closes the popup first and the recipe still stands', async () => {
    mount();
    fireEvent.click(trigger());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(popup()).toBeNull());
    expect(window.location.pathname).toBe('/r/honey-carrots/');
    expect(recipeHeading()).toBeTruthy();
  });

  it('"All techniques" opens Learning to Cook at that technique; Back returns to the recipe, popup closed', async () => {
    mount();
    fireEvent.click(trigger());
    fireEvent.click(within(popup()).getByRole('link', { name: 'All techniques in Learning to Cook' }));
    expect(window.location.pathname).toBe('/learning-to-cook/');
    expect(window.location.hash).toBe('#carrot-roll-cut');
    expect(screen.getByRole('heading', { level: 1, name: 'Learning to Cook' })).toBeTruthy();
    expect(popup()).toBeNull();

    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe('/r/honey-carrots/'));
    await waitFor(() => expect(recipeHeading()).toBeTruthy());
    expect(popup()).toBeNull();
    expect(window.history.state.technique).toBeUndefined();
  });
});

describe('Learning to Cook page', () => {
  const mount = (url = '/learning-to-cook/') => {
    window.history.replaceState(null, '', url);
    render(<App />);
  };

  it('opens on a direct load, with the intro and one card per technique in order', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1, name: 'Learning to Cook' })).toBeTruthy();
    expect(screen.getByText('The techniques the recipes lean on, each with a diagram, the how and the why.')).toBeTruthy();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Cutting chicken breasts into cutlets', 'Roll-cutting carrots']);
    expect(document.getElementById('chicken-breast-cutlets')).toBeTruthy();
    expect(document.getElementById('carrot-roll-cut')).toBeTruthy();
    expect(document.title).toBe("Learning to Cook — Baker's Recipe List");
  });

  it('shows Used in only where a recipe uses the technique, linking to its page', () => {
    mount();
    const carrots = document.getElementById('carrot-roll-cut');
    const link = within(carrots).getByRole('link', { name: 'Honey Carrots' });
    expect(link.getAttribute('href')).toBe('/r/honey-carrots/');
    expect(within(carrots).getByRole('heading', { name: 'Used in' })).toBeTruthy();
    const cutlets = document.getElementById('chicken-breast-cutlets');
    expect(within(cutlets).queryByRole('heading', { name: 'Used in' })).toBeNull();
    expect(within(cutlets).queryByRole('link')).toBeNull();
  });

  it('puts kicker, title, diagram, How and Why on a card', () => {
    mount();
    const card = document.getElementById('carrot-roll-cut');
    expect(within(card).getByText('Knife work · Vegetables')).toBeTruthy();
    expect(within(card).getByRole('img', { name: /Cutting carrots/ })).toBeTruthy();
    expect(within(card).getByRole('heading', { name: 'How' })).toBeTruthy();
    expect(within(card).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(within(card).getByRole('heading', { name: 'Why' })).toBeTruthy();
  });

  it('scrolls to the technique named in the address', () => {
    mount('/learning-to-cook/#carrot-roll-cut');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView.mock.contexts[0].id).toBe('carrot-roll-cut');
  });

  it('opens a recipe from Used in as a full page', () => {
    mount();
    fireEvent.click(within(document.getElementById('carrot-roll-cut')).getByRole('link', { name: 'Honey Carrots' }));
    expect(window.location.pathname).toBe('/r/honey-carrots/');
    expect(screen.getByRole('heading', { level: 1, name: 'Honey Carrots' })).toBeTruthy();
  });
});

describe('Learning to Cook footer link', () => {
  it('sits under the Recipes list and opens the page on a new entry; Back returns to the list', async () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
    render(<App />);
    const link = screen.getByRole('link', { name: 'Learning to Cook' });
    expect(link.getAttribute('href')).toBe('/learning-to-cook/');
    fireEvent.click(link);
    expect(window.location.pathname).toBe('/learning-to-cook/');
    expect(screen.getByRole('heading', { level: 1, name: 'Learning to Cook' })).toBeTruthy();
    await goBack();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.getByRole('link', { name: 'Learning to Cook' })).toBeTruthy();
  });
});
