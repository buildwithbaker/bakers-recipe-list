import { describe, it, expect } from 'vitest';
import {
  ABOUT, LIST, TAB_PINNED, TAB_RECIPES, TAB_SHOPPING,
  activeTab, entryOverlays, entryTab, goToTab, makeEntry, popOverlay, pushOverlay, tabTapAction,
} from './navHistory.js';

// A browser history in miniature: a stack of entries and a cursor. back()
// moves the cursor and fires `onpop` synchronously, the way App's popstate
// handler would see it.
function fakeHistory(first = null, url = '/') {
  const entries = [{ state: first, url }];
  let i = 0;
  const h = {
    onpop: () => {},
    get state() { return entries[i].state; },
    get url() { return entries[i].url; },
    get length() { return entries.length; },
    get index() { return i; },
    pushState(state, _t, u) { entries.splice(i + 1); entries.push({ state, url: u }); i += 1; },
    replaceState(state, _t, u) { entries[i] = { state, url: u }; },
    back() { if (i === 0) throw new Error('left the site'); i -= 1; h.onpop(); },
  };
  return h;
}

describe('tab taps', () => {
  const at = (tab, overlays = [], onRecipePage = false) => ({ tab, overlays, onRecipePage });

  it('pushes a switch, and scrolls to the top when the tab is already showing', () => {
    expect(tabTapAction({ tapped: TAB_PINNED, ...at(TAB_RECIPES) })).toEqual({ type: 'push', tab: TAB_PINNED });
    expect(tabTapAction({ tapped: TAB_RECIPES, ...at(TAB_RECIPES) })).toEqual({ type: 'scrollTop' });
  });

  it('leaves a full recipe page for the tab with a push, even the same tab', () => {
    expect(tabTapAction({ tapped: TAB_RECIPES, ...at(TAB_RECIPES, [], true) })).toEqual({ type: 'push', tab: TAB_RECIPES });
  });

  it('opens and closes the shopping list, and marks Shopping current while it is on top', () => {
    expect(tabTapAction({ tapped: TAB_SHOPPING, ...at(TAB_PINNED) })).toEqual({ type: 'openList' });
    expect(tabTapAction({ tapped: TAB_SHOPPING, ...at(TAB_PINNED, [LIST]) })).toEqual({ type: 'closeList' });
    expect(activeTab(TAB_PINNED, [LIST])).toBe(TAB_SHOPPING);
    expect(activeTab(TAB_PINNED, [])).toBe(TAB_PINNED);
  });

  it('replaces the list entry when another tab is tapped over the list', () => {
    expect(tabTapAction({ tapped: TAB_RECIPES, ...at(TAB_PINNED, [LIST]) })).toEqual({ type: 'replace', tab: TAB_RECIPES });
  });

  it('reads an entry with no state as the Recipes tab with nothing open', () => {
    expect(entryTab(null)).toBe(TAB_RECIPES);
    expect(entryTab({ tab: 'bogus' })).toBe(TAB_RECIPES);
    expect(entryOverlays(null)).toEqual([]);
  });
});

describe('Back through tabs and layers never leaves the site', () => {
  it('Recipes -> Pinned -> Shopping -> Recipes, then Back twice', () => {
    const h = fakeHistory();
    const entry = goToTab(h, { type: 'push', tab: TAB_PINNED }, '/');
    expect(entry).toEqual(makeEntry([], false, TAB_PINNED));

    const stack = pushOverlay(h, [], LIST, { page: false, tab: TAB_PINNED, url: '/' });
    expect(stack).toEqual([LIST]);
    expect(activeTab(entryTab(h.state), entryOverlays(h.state))).toBe(TAB_SHOPPING);

    // Recipes tapped over the list: the list entry becomes Recipes.
    const action = tabTapAction({ tapped: TAB_RECIPES, tab: TAB_PINNED, overlays: stack, onRecipePage: false });
    goToTab(h, action, '/');
    expect(h.length).toBe(3);
    expect(h.state).toEqual(makeEntry([], false, TAB_RECIPES));

    h.back();
    expect(entryTab(h.state)).toBe(TAB_PINNED);
    expect(entryOverlays(h.state)).toEqual([]);
    h.back();
    expect(entryTab(h.state)).toBe(TAB_RECIPES);
    expect(h.index).toBe(0);
  });

  it('opens About on its own entry; Back (or Close) pops only About', () => {
    const h = fakeHistory(makeEntry([], false, TAB_PINNED));
    const stack = pushOverlay(h, [], ABOUT, { page: false, tab: TAB_PINNED, url: '/' });
    expect(h.state).toEqual(makeEntry([ABOUT], false, TAB_PINNED));
    expect(pushOverlay(h, stack, ABOUT, { page: false, tab: TAB_PINNED, url: '/' })).toBe(stack); // no double push

    let popped = false;
    h.onpop = () => { popped = true; };
    expect(popOverlay(h, stack, ABOUT, { page: false, tab: TAB_PINNED, url: '/' })).toEqual({ navigating: true });
    expect(popped).toBe(true);
    expect(h.state).toEqual(makeEntry([], false, TAB_PINNED));
  });

  it('refuses to close a layer that is not on top', () => {
    const h = fakeHistory(makeEntry([LIST, ABOUT], false, TAB_RECIPES));
    expect(popOverlay(h, [LIST, ABOUT], LIST, { page: false, tab: TAB_RECIPES, url: '/' }).refused).toBe(true);
    expect(h.index).toBe(0);
  });

  it('closes without navigating when the entry lost its state', () => {
    const h = fakeHistory(null);
    const r = popOverlay(h, [ABOUT], ABOUT, { page: false, tab: TAB_RECIPES, url: '/' });
    expect(r).toEqual({ navigating: false, next: [] });
    expect(h.index).toBe(0);
    expect(h.state).toEqual(makeEntry([], false, TAB_RECIPES));
  });
});
