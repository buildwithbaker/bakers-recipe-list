// @vitest-environment jsdom
// The technique popup, against real (jsdom) history: the (i) after a step's
// title, the sheet it opens, the three ways to close it, focus, and Back.
// Back must close the popup and nothing else, and closing by X, scrim or Esc
// must not pile history entries up. Covered inside RecipeModal too, whose own
// Escape and Close must not fire while the popup is the top layer.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { displayRecipes } from '../../data/recipeIndex.js';
import { techniquesById } from '../../data/techniqueIndex.js';
import { DISPLAY_KEYS } from '../../utils/displaySettings.js';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
import RecipeView from './RecipeView.jsx';
import RecipeModal from '../RecipeModal/RecipeModal.jsx';

const carrots = displayRecipes.find((r) => r.id === 'honey-carrots');
const lasagna = displayRecipes.find((r) => r.id === 'lasagna');
const roll = techniquesById.get('carrot-roll-cut');

const withProviders = (ui) => <CookHistoryProvider>{ui}</CookHistoryProvider>;
const trigger = () => screen.getByRole('button', { name: `How to: ${roll.title}` });
const dialog = () => screen.queryByRole('dialog', { name: roll.title });
const backAndWait = async () => {
  await act(async () => { window.history.back(); });
  await waitFor(() => expect(window.history.state?.technique).toBeUndefined());
};

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  window.history.replaceState({ overlays: [], page: true, tab: 'recipes' }, '', '/r/honey-carrots/');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('the (i) button on a step', () => {
  it('sits after the title of the step that names a technique, and only that step', () => {
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    const buttons = screen.getAllByRole('button', { name: /^How to: / });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].tagName).toBe('BUTTON');
    expect(buttons[0].getAttribute('type')).toBe('button');
    expect(buttons[0].getAttribute('aria-label')).toBe('How to: Roll-cutting carrots');
    // Right after the step title: the next element in the same row.
    const title = screen.getByText('Cut', { selector: 'span' });
    expect(title.nextElementSibling).toBe(buttons[0]);
  });

  it.each([['on', '1'], ['off', '0']])('shows with the why notes %s', (_label, value) => {
    localStorage.setItem(DISPLAY_KEYS.why, value);
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    expect(trigger()).toBeTruthy();
  });

  it('is absent on a recipe whose steps name no technique', () => {
    render(withProviders(<RecipeView recipe={lasagna} headingLevel={1} />));
    expect(screen.queryByRole('button', { name: /^How to: / })).toBeNull();
  });

  it('leaves no embedded diagram or Technique section on the recipe page', () => {
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    expect(screen.queryByRole('region', { name: 'Technique' })).toBeNull();
    expect(screen.queryByRole('img', { name: /Cutting carrots/ })).toBeNull();
  });
});

describe('the popup', () => {
  it('opens as a modal dialog with kicker, title, diagram, How, Why and the link, in that order', () => {
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    fireEvent.click(trigger());
    const d = dialog();
    expect(d).toBeTruthy();
    expect(d.getAttribute('aria-modal')).toBe('true');

    const kicker = within(d).getByText(roll.kicker);
    const title = within(d).getByRole('heading', { name: roll.title });
    const img = within(d).getByRole('img', { name: roll.diagram.alt });
    const how = within(d).getByRole('list', { name: 'How' });
    const why = within(d).getByText(roll.why);
    const link = within(d).getByRole('link', { name: 'All techniques in Learning to Cook' });

    const order = [kicker, title, img, how, why, link];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(how.tagName).toBe('OL');
    expect([...how.querySelectorAll('li')].map((li) => li.textContent)).toEqual(roll.how);
    expect(img.getAttribute('src')).toMatch(/diagrams\/honey-carrots-roll-cut\.svg$/);
    expect(link.getAttribute('href')).toBe('/learning-to-cook/#carrot-roll-cut');
  });

  it('pushes exactly one history entry on open', () => {
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    const before = window.history.length;
    fireEvent.click(trigger());
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state.technique).toBe('carrot-roll-cut');
    // The rest of the entry rides along, so the app reads no change from it.
    expect(window.history.state).toMatchObject({ overlays: [], page: true, tab: 'recipes' });
    expect(window.location.pathname).toBe('/r/honey-carrots/');
  });

  it.each([
    ['the X', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['a tap on the scrim', () => fireEvent.click(document.querySelector('[aria-hidden="true"][class*="scrim"]'))],
    ['Escape', () => fireEvent.keyDown(document.body, { key: 'Escape' })],
  ])('closes with %s, leaving the recipe and no leftover entry', async (_label, close) => {
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    const before = window.history.length;
    fireEvent.click(trigger());
    close();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(window.history.state.technique).toBeUndefined();
    expect(window.location.pathname).toBe('/r/honey-carrots/');
    expect(screen.getByRole('heading', { level: 1, name: 'Honey Carrots' })).toBeTruthy();

    // Opening and closing again does not stack entries: the second open
    // replaces the forward entry the first close left, it does not add one.
    const afterFirst = window.history.length;
    expect(afterFirst).toBeLessThanOrEqual(before + 1);
    fireEvent.click(trigger());
    close();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(window.history.length).toBe(afterFirst);
  });

  it('closes on the browser Back button, staying on the recipe', async () => {
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    fireEvent.click(trigger());
    expect(dialog()).toBeTruthy();
    await backAndWait();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(window.location.pathname).toBe('/r/honey-carrots/');
    expect(window.history.state).toMatchObject({ page: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Honey Carrots' })).toBeTruthy();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('moves focus into the sheet, traps it there, and returns it to the (i) on close', async () => {
    // jsdom has no layout, so every offsetParent is null and the focus trap
    // would treat every control as hidden. Give them one.
    const desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.parentNode; } });
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    const opener = trigger();
    opener.focus();
    fireEvent.click(opener);
    const d = dialog();
    expect(d.contains(document.activeElement)).toBe(true);

    // Tab from the last control wraps to the first, and Shift+Tab the other way.
    const controls = [...d.querySelectorAll('a[href], button')];
    const first = controls[0];
    const last = controls.at(-1);
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(opener);
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', desc);
  });

  it('is restored from the history entry (Forward, reload), but only for a technique the recipe uses', () => {
    window.history.replaceState({ overlays: [], page: true, tab: 'recipes', technique: 'carrot-roll-cut' }, '', '/r/honey-carrots/');
    const { unmount } = render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    expect(dialog()).toBeTruthy();
    unmount();
    cleanup();
    window.history.replaceState({ overlays: [], page: true, tab: 'recipes', technique: 'chicken-breast-cutlets' }, '', '/r/honey-carrots/');
    render(withProviders(<RecipeView recipe={carrots} headingLevel={1} />));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the popup inside RecipeModal', () => {
  const renderModal = () => {
    const onClose = vi.fn();
    render(withProviders(<RecipeModal recipe={carrots} onClose={onClose} />));
    return onClose;
  };

  it('Escape closes only the popup; a second Escape closes the card', async () => {
    const onClose = renderModal();
    fireEvent.click(trigger());
    expect(dialog()).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(dialog()).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Honey Carrots' })).toBeTruthy();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Back closes only the popup, and a tap on its scrim does not close the card', async () => {
    const onClose = renderModal();
    fireEvent.click(trigger());
    await backAndWait();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Honey Carrots' })).toBeTruthy();

    fireEvent.click(trigger());
    fireEvent.click(document.querySelector('[aria-hidden="true"][class*="scrim"]'));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('gives focus back to the (i) rather than the card behind it', async () => {
    renderModal();
    const opener = trigger();
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});
