// The history rules for tabs and layers, kept free of React and of `window`
// so they are unit-tested against a fake history (navHistory.test.js). App.jsx
// passes window.history in.
//
// Every entry the app writes carries the same state shape:
//   { overlays: [...layer tokens], page: bool, tab: 'recipes' | 'pinned' }
// `overlays` is the layer stack open at that entry, `page` whether the recipe
// in the path renders as a full page, `tab` which main view sits underneath.
// Back therefore pops exactly one step: a layer, a recipe, or a tab switch.

export const LIST = 'list';     // the shopping list layer
export const ABOUT = 'about';   // the About sheet

export const TAB_RECIPES = 'recipes';
export const TAB_PINNED = 'pinned';
export const TAB_SHOPPING = 'shopping';
const VIEW_TABS = [TAB_RECIPES, TAB_PINNED];

export const entryOverlays = (state) => (Array.isArray(state?.overlays) ? state.overlays : []);
export const entryIsPage = (state) => !!state?.page;
export const entryTab = (state) => (VIEW_TABS.includes(state?.tab) ? state.tab : TAB_RECIPES);

export const makeEntry = (overlays, page, tab) => ({ overlays, page: !!page, tab });

/** The tab the bar marks as current: Shopping while its list is the top layer. */
export function activeTab(tab, overlays) {
  return overlays[overlays.length - 1] === LIST ? TAB_SHOPPING : tab;
}

/**
 * What a tap on a tab does. Pure: App carries the action out.
 *   scrollTop  the tab is already showing: back to the top of it
 *   openList / closeList
 *   push       a new entry for the tab (a real Back stop)
 *   replace    the shopping list's entry becomes the tab's entry, so Back from
 *              the new tab returns to where the list was opened, not to the list
 */
export function tabTapAction({ tapped, tab, overlays, onRecipePage }) {
  const listOnTop = overlays[overlays.length - 1] === LIST;
  if (tapped === TAB_SHOPPING) return { type: listOnTop ? 'closeList' : 'openList' };
  if (listOnTop) return { type: 'replace', tab: tapped };
  if (onRecipePage || tapped !== tab) return { type: 'push', tab: tapped };
  return { type: 'scrollTop' };
}

/** Writes the entry for a push/replace tab action; returns the new entry. */
export function goToTab(history, action, url) {
  const entry = makeEntry([], false, action.tab);
  if (action.type === 'replace') history.replaceState(entry, '', url);
  else history.pushState(entry, '', url);
  return entry;
}

/** Opens a layer on a new entry. Returns the new stack (unchanged if already open). */
export function pushOverlay(history, stack, token, { page, tab, url }) {
  if (stack.includes(token)) return stack;
  const next = [...stack, token];
  history.pushState(makeEntry(next, page, tab), '', url);
  return next;
}

/**
 * Closes the top layer. Normally by stepping Back (the popstate handler then
 * reads the entry and finishes the close): `{ navigating: true }`. If the
 * entry's state was lost, rewrites it instead: `{ navigating: false, next }`.
 * A layer that is not on top is refused: the top layer owns Back and Escape.
 */
export function popOverlay(history, stack, token, { page, tab, url }) {
  if (stack[stack.length - 1] !== token) return { navigating: false, next: stack, refused: true };
  if (entryOverlays(history.state).length === stack.length) {
    history.back();
    return { navigating: true };
  }
  const next = stack.slice(0, -1);
  history.replaceState(makeEntry(next, page, tab), '', url);
  return { navigating: false, next };
}
