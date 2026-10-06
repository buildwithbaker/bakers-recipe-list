import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRecipe } from './data/recipeIndex.js';
import { SECTIONS } from './data/sections.js';
import { SECTION_CATEGORY } from './data/catalog.js';
import Masthead from './components/Masthead/Masthead.jsx';
import UsdaKeyNotice from './components/UsdaKeyNotice/UsdaKeyNotice.jsx';
import RecipeList from './components/RecipeList/RecipeList.jsx';
import RecipeModal from './components/RecipeModal/RecipeModal.jsx';
import RecipePage from './components/RecipePage/RecipePage.jsx';
import SearchBar from './components/SearchBar/SearchBar.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import ShoppingList from './components/ShoppingList/ShoppingList.jsx';
import TabBar from './components/TabBar/TabBar.jsx';
import PinnedList from './components/PinnedList/PinnedList.jsx';
import AboutPage from './components/AboutPage/AboutPage.jsx';
import { CookHistoryProvider } from './context/CookHistoryContext.jsx';
import { useRecentlyViewed } from './hooks/useRecentlyViewed.js';
import { useShoppingList } from './hooks/useShoppingList.js';
import { scaleIngredientText } from './utils/scaleIngredient.js';
import { BASE_PATH, aboutPath, isAboutPath, recipePath, recipeKeyFromPath } from './utils/recipeRoute.js';
import {
  LIST, TAB_RECIPES,
  activeTab, entryIsPage, entryOverlays as overlaysOf, entryTab, goToTab, makeEntry, popOverlay, pushOverlay, tabTapAction,
} from './utils/navHistory.js';

/*
 * Routing model
 * -------------
 * THE PATH IS THE OPEN RECIPE. /r/<slug>/ names one recipe and nothing else,
 * which is what lets scripts/prerender.mjs put a real file with real Open Graph
 * tags at that address — a link-preview crawler runs no JavaScript, so a query
 * string could never have carried this. `?recipe=` still resolves forever; a
 * legacy link is rewritten to its path on load.
 *
 * /about/ is the one other page, prerendered the same way. Going there is a
 * push like opening a recipe, so Back returns to whatever was on screen
 * before: the list, a tab, a card, a recipe page.
 *
 * Overlay history model
 * ---------------------
 * The dismissable layer, the shopping list, pushes a history entry when it
 * opens. The entry's `history.state.overlays` array
 * records the full stack open at that entry, so Back pops exactly one layer
 * instead of leaving the site, and Forward restores it. The recipe is NOT in
 * that array: it is in the URL, so Back pops it for free.
 *
 * Layers nest: the card's "List" button opens the shopping list on top of the
 * card, so Back closes the list first, then the card, then leaves the site.
 * Only the topmost layer responds to Back / Escape / its own close button —
 * that is what stops a single Escape from closing two stacked layers at once,
 * and it is why closing the recipe is refused while an overlay sits above it.
 *
 * Tabs
 * ----
 * Recipes and Pinned are views; Shopping opens the shopping list layer. Each
 * entry records its `tab`, and a tab switch pushes an entry, only from the
 * tap itself, so Back returns to the previous tab. The rules, and the state
 * shape every entry carries, live in utils/navHistory.js (unit-tested).
 */

// An old #sec-<SECTION> link from the retired sections drawer lands on the
// matching category rather than nowhere. A link to a removed To Try or For
// Review section (#sec-TO-TRY-*, #sec-FOR-REVIEW-*) matches nothing and lands
// on the whole Cookbook list.
function landingCategory() {
  try {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const section = id && SECTIONS.find((s) => s.id === id);
    if (section) return SECTION_CATEGORY[section.key] ?? '';
  } catch { /* fall through */ }
  return '';
}

function getParam(key) {
  try { return new URLSearchParams(window.location.search).get(key) || ''; }
  catch { return ''; }
}

// The current query string with `recipe` dropped — the path carries the recipe
// now, so keeping the legacy parameter alongside it would mean two sources of
// truth in one URL. `?q=` and anything else survives untouched.
function searchWithoutRecipe() {
  try {
    const params = new URLSearchParams(window.location.search);
    params.delete('recipe');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  } catch { return ''; }
}

const listUrl = () => `${BASE_PATH}${searchWithoutRecipe()}`;
const urlForRecipe = (id) => `${recipePath(id)}${searchWithoutRecipe()}`;

// Builds a URL string from the current location with `key` set (or removed when
// falsy). Keeps the pathname: it is the route now, not decoration.
function urlWithParam(key, value) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value); else params.delete(key);
  const qs = params.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

// Rewrites the current history entry. Used for search — typing must not create
// a back-button stop for every keystroke. Preserves history.state so the overlay
// stack recorded on this entry survives.
function setParam(key, value) {
  try {
    window.history.replaceState(window.history.state, '', urlWithParam(key, value));
  } catch { /* ignore */ }
}

// The overlay stack recorded on the current history entry.
function entryOverlays() {
  try { return overlaysOf(window.history.state); } catch { return []; }
}

// Whether the current history entry renders its recipe as a full page.
function isPageEntry() {
  try { return entryIsPage(window.history.state); } catch { return false; }
}

// The tab recorded on the current history entry.
function currentEntryTab() {
  try { return entryTab(window.history.state); } catch { return TAB_RECIPES; }
}

// Nothing but the recipe is mirrored into the URL, so opening or closing an
// overlay keeps the address exactly as it is — path, query and hash.
function currentUrl() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

// Where the app starts, read once. The path wins; `?recipe=` is the legacy form
// and is accepted by id, display name, raw pre-expansion name, or the frozen
// manifest's legacy name (resolveRecipe in recipeIndex.js), so every link ever
// shared still opens. `key` is kept alongside `id` because a key that does NOT
// resolve still has to be cleaned out of the URL.
function initialRoute() {
  const key = recipeKeyFromPath(window.location.pathname) || getParam('recipe');
  const recipe = key ? resolveRecipe(key) : null;
  return { key, id: recipe ? recipe.id : '' };
}

function AppInner() {
  const [landing] = useState(initialRoute);
  const [recipeId, setRecipeId] = useState(landing.id);
  // Modal or page — a presentation choice on ONE route, recorded per history
  // entry as `state.page` so Back, Forward and RELOAD all restore what was on
  // screen. A reload keeps history.state, so that entry is the authority; only
  // a fresh arrival has no state to read, and arriving on /r/<slug>/ itself
  // means a page, because there is no list behind it to lay a card over.
  const [pageView, setPageView] = useState(() => (window.history.state ? isPageEntry() : !!landing.id));
  // The About page: read off the path, like the recipe.
  const [aboutView, setAboutView] = useState(() => isAboutPath(window.location.pathname));
  const [overlays, setOverlays] = useState(entryOverlays);
  const [tab, setTab] = useState(currentEntryTab);
  const [searchQuery, setSearchQuery] = useState(() => getParam('q'));
  // Which category the list shows. Owned here so it survives the list
  // unmounting behind a full recipe page.
  const [category, setCategory] = useState(landingCategory);
  const searchBarRef = useRef(null);
  // Mirrors `overlays` for use inside callbacks that must not re-create on every change.
  const overlaysRef = useRef(overlays);
  // Same, for the open recipe — closeRecipe must not be rebuilt per navigation.
  const recipeIdRef = useRef(recipeId);
  // Same, for the tab: every entry written records it.
  const tabRef = useRef(tab);
  // Same, for About: a tab tap from it has to leave it.
  const aboutRef = useRef(aboutView);
  // Holds a tag search that must be applied after a back navigation lands.
  const pendingSearchRef = useRef(null);
  const [recentHistory, addToHistory, clearHistory] = useRecentlyViewed();
  const [listItems, addListItems, toggleListItem, removeListItem, clearChecked, clearAll] = useShoppingList();

  const selectedRecipe = recipeId ? resolveRecipe(recipeId) : null;
  const listOpen = overlays.includes(LIST);
  const fullPage = !!selectedRecipe && pageView;

  const applyOverlays = useCallback((next) => {
    overlaysRef.current = next;
    setOverlays(next);
  }, []);

  const applyRecipe = useCallback((id) => {
    recipeIdRef.current = id;
    setRecipeId(id);
  }, []);

  const applyTab = useCallback((next) => {
    tabRef.current = next;
    setTab(next);
  }, []);

  const applyAbout = useCallback((on) => {
    aboutRef.current = on;
    setAboutView(on);
  }, []);

  // Opening a layer PUSHES a history entry, so Back pops the layer, not the site.
  // The URL does not change: only the recipe is mirrored into it. `page` rides
  // along so that popping back to this entry restores the same rendering.
  const openOverlay = useCallback((token) => {
    try {
      applyOverlays(pushOverlay(window.history, overlaysRef.current, token, { page: isPageEntry(), tab: tabRef.current, url: currentUrl() }));
    } catch { /* ignore */ }
  }, [applyOverlays]);

  // Closing the topmost layer steps Back through its entry, keeping the stack in sync.
  // Returns true when a back navigation is in flight (popstate will finish the close).
  // A layer buried under another is refused: the topmost layer owns Back and
  // Escape. If history.state was lost (e.g. an external replaceState), it
  // closes without navigating.
  const closeOverlay = useCallback((token) => {
    try {
      const r = popOverlay(window.history, overlaysRef.current, token, { page: isPageEntry(), tab: tabRef.current, url: currentUrl() });
      if (r.navigating) return true;
      if (!r.refused) applyOverlays(r.next);
    } catch { /* ignore */ }
    return false;
  }, [applyOverlays]);

  // Opening a recipe is a real navigation: the path changes and a history entry
  // is pushed, carrying whatever overlays were already open so Forward restores
  // them. No overlay bookkeeping for the card itself — Back pops the path.
  const openRecipe = useCallback((recipe, asPage) => {
    try {
      window.history.pushState(makeEntry(overlaysRef.current, asPage, tabRef.current), '', urlForRecipe(recipe.id));
    } catch { /* ignore */ }
    applyRecipe(recipe.id);
    setPageView(asPage);
    addToHistory(recipe);
  }, [applyRecipe, addToHistory]);

  // From the list: a card over the list the visitor is already looking at.
  const handleViewRecipe = useCallback((recipe) => openRecipe(recipe, false), [openRecipe]);

  // From a related link on a full page: another full page. The href on that
  // link points at /r/<slug>/, and someone with JavaScript off lands on the
  // page — so a click with JavaScript on has to arrive somewhere that matches,
  // not at a card over a list they have never seen.
  const handleViewRelated = useCallback((recipe) => {
    openRecipe(recipe, true);
    window.scrollTo({ top: 0 });
  }, [openRecipe]);

  // Leaves the recipe for the list WITHOUT a back navigation — used when the
  // destination is the list plus something else (a section anchor, a tag
  // search), where stepping back would land on an entry we then have to fight.
  // Lands on the Recipes tab, where search and the categories live.
  const goToList = useCallback(() => {
    try { window.history.pushState(makeEntry([], false, TAB_RECIPES), '', listUrl()); } catch { /* ignore */ }
    applyOverlays([]);
    applyRecipe('');
    applyAbout(false);
    applyTab(TAB_RECIPES);
    setPageView(false);
  }, [applyOverlays, applyRecipe, applyAbout, applyTab]);

  // Returns true when a back navigation is in flight (popstate finishes the close).
  const closeRecipe = useCallback(() => {
    if (!recipeIdRef.current) return false;
    // An overlay sits above the card — it owns Back and Escape until it closes.
    if (overlaysRef.current.length) return false;
    // The bootstrap effect below guarantees a list entry behind every recipe
    // entry, so Back is the normal path. If history.state is missing the push
    // never happened, and stepping back would leave the site — rewrite instead.
    if (window.history.state) {
      window.history.back();
      return true;
    }
    try { window.history.replaceState(makeEntry([], false, tabRef.current), '', listUrl()); } catch { /* ignore */ }
    applyRecipe('');
    setPageView(false);
    return false;
  }, [applyRecipe]);

  const handleCloseModal = useCallback(() => { closeRecipe(); }, [closeRecipe]);

  // The modal and the page are the same route, so "open full page" is not a
  // navigation: same URL, same history entry, different rendering. Recording it
  // on the entry is what makes Back out of a layer opened from the page return
  // to the page rather than to a card.
  const handleOpenFullPage = useCallback(() => {
    try {
      window.history.replaceState(makeEntry(overlaysRef.current, true, tabRef.current), '', currentUrl());
    } catch { /* ignore */ }
    setPageView(true);
    window.scrollTo({ top: 0 });
  }, []);

  const handleListClose = useCallback(() => { closeOverlay(LIST); }, [closeOverlay]);
  // The masthead's (i), and the AI photo caption (with `hash` 'photos'): a
  // real navigation to /about/, so Back returns to where it was opened from.
  // Already there: only the anchor changes, on the same entry.
  const handleAbout = useCallback((hash = '') => {
    try {
      const url = `${aboutPath()}${searchWithoutRecipe()}${hash ? `#${hash}` : ''}`;
      if (aboutRef.current) window.history.replaceState(window.history.state, '', url);
      else window.history.pushState(makeEntry([], false, tabRef.current), '', url);
    } catch { /* ignore */ }
    applyOverlays([]);
    applyRecipe('');
    setPageView(false);
    if (aboutRef.current) {
      const target = hash && document.getElementById(hash);
      if (target) target.scrollIntoView(); else window.scrollTo({ top: 0 });
    }
    applyAbout(true);
  }, [applyOverlays, applyRecipe, applyAbout]);

  // A tab tap: the only place a tab switch writes history.
  const handleTab = useCallback((tapped) => {
    const action = tabTapAction({
      tapped,
      tab: tabRef.current,
      overlays: overlaysRef.current,
      // About is a page of its own: any tab leaves it, the current one too.
      onRecipePage: !!recipeIdRef.current || aboutRef.current,
    });
    if (action.type === 'scrollTop') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (action.type === 'openList') { openOverlay(LIST); return; }
    if (action.type === 'closeList') { closeOverlay(LIST); return; }
    try { goToTab(window.history, action, listUrl()); } catch { /* ignore */ }
    applyOverlays([]);
    applyRecipe('');
    applyAbout(false);
    setPageView(false);
    applyTab(action.tab);
    window.scrollTo({ top: 0 });
  }, [openOverlay, closeOverlay, applyOverlays, applyRecipe, applyAbout, applyTab]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setParam('q', query);
  }, []);

  // Tag click leaves the recipe and searches the tag. When the close triggers a back
  // navigation the search is deferred until the pop lands, otherwise the popstate
  // handler would overwrite the URL and drop `q`.
  const handleTagClick = useCallback((tag) => {
    // Search lives on the Recipes tab: from a page, or from a card over
    // Pinned, go there instead of stepping Back to a view without it.
    if (fullPage || tabRef.current !== TAB_RECIPES) {
      goToList();
      handleSearch(tag);
      return;
    }
    pendingSearchRef.current = tag;
    if (!closeRecipe()) {
      pendingSearchRef.current = null;
      handleSearch(tag);
    }
  }, [closeRecipe, handleSearch, fullPage, goToList]);

  // Called from RecipeModal's "List" button — adds scaled ingredients to shopping list.
  // The list opens on TOP of the card, so Back closes the list and leaves the card open.
  const handleAddToList = useCallback((recipeId, ingredients, scale) => {
    const texts = ingredients
      .filter((ing) => ing.type === 'item')
      .map((ing) => scaleIngredientText(ing.text, scale));
    addListItems(recipeId, texts);
    openOverlay(LIST);
  }, [addListItems, openOverlay]);

  // Back/forward is the single source of truth for what is on screen: the path
  // says which recipe, `state.overlays` says which layers, `state.page` says
  // card or page. Nothing here decides — it reads the entry we landed on.
  useEffect(() => {
    const onPopState = () => {
      applyOverlays(entryOverlays());
      const key = recipeKeyFromPath(window.location.pathname);
      const recipe = key ? resolveRecipe(key) : null;
      applyRecipe(recipe ? recipe.id : '');
      applyAbout(isAboutPath(window.location.pathname));
      setPageView(isPageEntry());
      applyTab(currentEntryTab());
      const pending = pendingSearchRef.current;
      if (pending !== null) {
        pendingSearchRef.current = null;
        setSearchQuery(pending);
        setParam('q', pending);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyOverlays, applyRecipe, applyAbout, applyTab]);

  // A shared link — /r/spicy-pork-patties/ or the legacy ?recipe=Chili — opens
  // straight into a recipe with nothing behind it. Rewrite that first entry to
  // the plain list, then push the recipe on top, so Back has an in-app
  // destination instead of dumping the visitor off the site. That push is also
  // what turns a legacy `?recipe=` link into its `/r/<slug>/` equivalent.
  //
  // `history.state` is the "this entry is ours" marker: a reload preserves it,
  // so re-running would duplicate the entry. A link that resolves to nothing
  // (a stale id, a renamed recipe) just gets its URL cleaned back to the list —
  // being shown the list beats being shown an error.
  useEffect(() => {
    if (!landing.key || window.history.state) return;
    try {
      window.history.replaceState(makeEntry([], false, TAB_RECIPES), '', listUrl());
      if (!landing.id) return;
      window.history.pushState(makeEntry([], true, TAB_RECIPES), '', urlForRecipe(landing.id));
    } catch { /* ignore */ }
  }, [landing]);

  // The same rule for a direct load of /about/: the list goes in behind it, so
  // Back lands on the recipes rather than off the site. The About URL is kept
  // whole (query and #photos). Same "this entry is ours" marker as above, so a
  // reload or an in-app arrival never adds a second entry.
  const [landedOnAbout] = useState(() => isAboutPath(window.location.pathname));
  useEffect(() => {
    if (!landedOnAbout || window.history.state) return;
    try {
      const aboutUrl = currentUrl();
      window.history.replaceState(makeEntry([], false, TAB_RECIPES), '', listUrl());
      window.history.pushState(makeEntry([], false, TAB_RECIPES), '', aboutUrl);
    } catch { /* ignore */ }
  }, [landedOnAbout]);

  // "/" focuses the search bar when nothing is layered over the list.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/') return;
      if (overlays.length) return;
      const active = document.activeElement;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      searchBarRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [overlays]);

  const uncheckedCount = listItems.filter((it) => !it.checked).length;

  const pinnedView = tab !== TAB_RECIPES;
  const navProps = { active: activeTab(tab, overlays), onTab: handleTab, listCount: uncheckedCount };

  return (
    <ErrorBoundary>
      <Masthead
        nav={<TabBar placement="header" {...navProps} />}
        onAbout={handleAbout}
        aboutCurrent={aboutView}
        siteTitleIsHeading={!fullPage && !aboutView}
        slim={fullPage || pinnedView || aboutView}
        onHome={fullPage || aboutView ? goToList : undefined}
      />
      {aboutView ? (
        <ErrorBoundary key="__about__">
          <AboutPage />
        </ErrorBoundary>
      ) : fullPage ? (
        // Arrived here from a shared link: there is no list to lay a card over,
        // so the recipe IS the page. Same URL either way.
        <ErrorBoundary key={selectedRecipe.id}>
          <UsdaKeyNotice />
          <RecipePage
            recipe={selectedRecipe}
            onBackToList={handleCloseModal}
            onTagClick={handleTagClick}
            onAddToList={handleAddToList}
            onViewRelated={handleViewRelated}
            onAbout={handleAbout}
          />
        </ErrorBoundary>
      ) : (
        <>
          {pinnedView ? (
            <PinnedList onViewRecipe={handleViewRecipe} />
          ) : (
            <>
              <SearchBar ref={searchBarRef} value={searchQuery} onChange={handleSearch} />
              <UsdaKeyNotice />
              <RecipeList
                onViewRecipe={handleViewRecipe}
                searchQuery={searchQuery}
                onSearch={handleSearch}
                category={category}
                onCategoryChange={setCategory}
                recentHistory={recentHistory}
                onClearRecent={clearHistory}
              />
            </>
          )}
          <ErrorBoundary key={selectedRecipe?.id ?? '__none__'}>
            <RecipeModal
              recipe={selectedRecipe}
              onClose={handleCloseModal}
              onOpenFullPage={handleOpenFullPage}
              onTagClick={handleTagClick}
              onAddToList={handleAddToList}
              onAbout={handleAbout}
            />
          </ErrorBoundary>
        </>
      )}
      <ShoppingList
        items={listItems}
        open={listOpen}
        onClose={handleListClose}
        onToggle={toggleListItem}
        onRemove={removeListItem}
        onClearChecked={clearChecked}
        onClearAll={clearAll}
      />
      <TabBar placement="bottom" {...navProps} />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <CookHistoryProvider>
      <AppInner />
    </CookHistoryProvider>
  );
}
