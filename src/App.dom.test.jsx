// @vitest-environment jsdom
// The masthead's About button against real (jsdom) history: off About it opens
// the page with a push; on About it closes it by stepping Back, never by
// pushing another entry. vitest's BASE_URL is '/', so About lives at /about/.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App.jsx';

const aboutButton = () => screen.getByRole('link', { name: /about this site|close about page/i });

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

describe('masthead About button', () => {
  it('off About: opens /about/ on a new history entry', () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/');
    render(<App />);
    const before = window.history.length;
    const button = aboutButton();
    expect(button.getAttribute('aria-label')).toBe('About this site');
    expect(button.getAttribute('aria-current')).toBeNull();

    fireEvent.click(button);
    expect(window.location.pathname).toBe('/about/');
    expect(window.history.length).toBe(before + 1);
    expect(screen.getByRole('heading', { level: 1, name: "About Baker's Recipe List" })).toBeTruthy();
  });

  it('on About: marks itself current and closes the page by stepping Back, pushing nothing', () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/about/');
    render(<App />);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const push = vi.spyOn(window.history, 'pushState');
    const before = window.history.length;
    const button = aboutButton();
    expect(button.getAttribute('aria-label')).toBe('Close About page');
    expect(button.getAttribute('aria-current')).toBe('page');
    expect(button.getAttribute('href')).toBe('/about/');

    fireEvent.click(button);
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(before);
  });

  it('on About: a modified click is left to the browser (a new tab)', () => {
    window.history.replaceState({ overlays: [], page: false, tab: 'recipes' }, '', '/about/');
    render(<App />);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    aboutButton().dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(back).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/about/');
  });
});
