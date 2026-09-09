import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRecipe } from './data/recipeIndex.js';
import { TAB_RECIPES } from './data/navSections.js';
import TopBar from './components/TopBar/TopBar.jsx';
import UsdaKeyNotice from './components/UsdaKeyNotice/UsdaKeyNotice.jsx';
import TOCNav from './components/TOCNav/TOCNav.jsx';
import RecipeList from './components/RecipeList/RecipeList.jsx';
import RecipeModal from './components/RecipeModal/RecipeModal.jsx';
import RecipePage from './components/RecipePage/RecipePage.jsx';
import SearchBar from './components/SearchBar/SearchBar.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import RecentlyViewed from './components/RecentlyViewed/RecentlyViewed.jsx';
import BackToTop from './components/BackToTop/BackToTop.jsx';
import ShoppingList from './components/ShoppingList/ShoppingList.jsx';
import Footer from './components/Footer/Footer.jsx';
import { CookHistoryProvider } from './context/CookHistoryContext.jsx';
import { useRecentlyViewed } from './hooks/useRecentlyViewed.js';
import { useShoppingList } from './hooks/useShoppingList.js';
import { useDarkMode } from './hooks/useDarkMode.js';
import { scaleIngredientText } from './utils/scaleIngredient.js';
import { BASE_PATH, recipePath, recipeKeyFromPath } from './utils/recipeRoute.js';

/*
 * Routing model
 * -------------
 * THE PATH IS THE OPEN RECIPE. /r/<slug>/ names one recipe and nothing else,
 * which is what lets scripts/prerender.mjs put a real file with real Open Graph
 * tags at that address — a link-preview crawler runs no JavaScript, so a query
 * string could never have carried this. `?recipe=` still resolves forever; a
 * legacy link is rewritten to its path on load.
 *
 * Overlay history model
 * ---------------------
 * The remaining dismissable layers — shopping list, sections menu — push a
 * history entry when they open. The entry's `history.state.overlays` array
 * records the full stack open at that entry, so Back pops exactly one layer
 * instead of leaving the site, and Forward restores it. The recipe is NOT in
 * that array: it is in the URL, so Back pops it for free.
 *
 * Layers nest: the card's "List" button opens the shopping list on top of the
 * card, so Back closes the list first, then the card, then leaves the site.
 * Only the topmost layer responds to Back / Escape / its own close button —
 * that is what stops a single Escape from closing two stacked layers at once,
 * and it is why closing the recipe is refused while an overlay sits above it.
 */
const MENU = 'menu';
const LIST = 'list';

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
  try {
    const list = window.history.state?.overlays;
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Whether the current history entry renders its recipe as a full page.
function isPageEntry() {
  try { return !!window.history.state?.page; } catch { return false; }
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
  // entry as `state.page` so Back and Forward restore what was on screen. True
  // from the first paint when the visitor arrived on /r/<slug>/ itself: there
  // is no list behind them to lay a card over.
  const [pageView, setPageView] = useState(() => !!landing.id);
  const [overlays, setOverlays] = useState(entryOverlays);
  const [searchQuery, setSearchQuery] = useState(() => getParam('q'));
  // Which list tab is showing. Owned here, not in RecipeList, because the
  // sections drawer can link to a section on a tab that is not the active one.
  const [activeTab, setActiveTab] = useState(TAB_RECIPES);
  // Section id waiting to be scrolled to once its tab has rendered and the
  // drawer has closed.
  const [pendingAnchor, setPendingAnchor] = useState(null);
  const searchBarRef = useRef(null);
  // Mirrors `overlays` for use inside callbacks that must not re-create on every change.
  const overlaysRef = useRef(overlays);
  // Same, for the open recipe — closeRecipe must not be rebuilt per navigation.
  const recipeIdRef = useRef(recipeId);
  // Holds a tag search that must be applied after a back navigation lands.
  const pendingSearchRef = useRef(null);
  const [recentHistory, addToHistory, clearHistory] = useRecentlyViewed();
  const [darkMode, toggleDark] = useDarkMode();
  const [listItems, addListItems, toggleListItem, removeListItem, clearChecked, clearAll] = useShoppingList();

  const selectedRecipe = recipeId ? resolveRecipe(recipeId) : null;
  const menuOpen = overlays.includes(MENU);
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

  // Opening a layer PUSHES a history entry, so Back pops the layer, not the site.
  // The URL does not change: only the recipe is mirrored into it. `page` rides
  // along so that popping back to this entry restores the same rendering.
  const openOverlay = useCallback((token) => {
    if (overlaysRef.current.includes(token)) return;
    const next = [...overlaysRef.current, token];
    try {
      window.history.pushState({ overlays: next, page: isPageEntry() }, '', currentUrl());
    } catch { /* ignore */ }
    applyOverlays(next);
  }, [applyOverlays]);

  // Closing the topmost layer steps Back through its entry, keeping the stack in sync.
  // Returns true when a back navigation is in flight (popstate will finish the close).
  const closeOverlay = useCallback((token) => {
    const stack = overlaysRef.current;
    // Not open, or buried under another layer: the topmost layer owns Back and Escape.
    if (stack[stack.length - 1] !== token) return false;
    if (entryOverlays().length === stack.length) {
      window.history.back();
      return true;
    }
    // history.state was lost (e.g. an external replaceState) — close without navigating.
    const next = stack.slice(0, -1);
    try { window.history.replaceState({ overlays: next, page: isPageEntry() }, '', currentUrl()); } catch { /* ignore */ }
    applyOverlays(next);
    return false;
  }, [applyOverlays]);

  // Opening a recipe is a real navigation: the path changes and a history entry
  // is pushed, carrying whatever overlays were already open so Forward restores
  // them. No overlay bookkeeping for the card itself — Back pops the path.
  const handleViewRecipe = useCallback((recipe) => {
    try {
      window.history.pushState({ overlays: overlaysRef.current, page: false }, '', urlForRecipe(recipe.id));
    } catch { /* ignore */ }
    applyRecipe(recipe.id);
    setPageView(false);
    addToHistory(recipe);
  }, [applyRecipe, addToHistory]);

  // Leaves the recipe for the list WITHOUT a back navigation — used when the
  // destination is the list plus something else (a section anchor, a tag
  // search), where stepping back would land on an entry we then have to fight.
  const goToList = useCallback(() => {
    try { window.history.pushState({ overlays: [], page: false }, '', listUrl()); } catch { /* ignore */ }
    applyOverlays([]);
    applyRecipe('');
    setPageView(false);
  }, [applyOverlays, applyRecipe]);

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
    try { window.history.replaceState({ overlays: [], page: false }, '', listUrl()); } catch { /* ignore */ }
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
      window.history.replaceState({ overlays: overlaysRef.current, page: true }, '', currentUrl());
    } catch { /* ignore */ }
    setPageView(true);
    window.scrollTo({ top: 0 });
  }, []);

  const handleMenuToggle = useCallback(() => {
    if (overlaysRef.current.includes(MENU)) closeOverlay(MENU); else openOverlay(MENU);
  }, [openOverlay, closeOverlay]);
  const handleMenuClose = useCallback(() => { closeOverlay(MENU); }, [closeOverlay]);

  // A drawer entry may belong to another tab, so switch to the tab that renders
  // the section first and record the anchor; the effect below does the scroll
  // once that tab has painted and the drawer is actually gone. From the full
  // page there is no list underneath, so this navigates to one.
  const handleNavigateSection = useCallback((section) => {
    setActiveTab(section.tab);
    setPendingAnchor(section.id);
    if (fullPage) goToList(); else closeOverlay(MENU);
  }, [closeOverlay, fullPage, goToList]);

  const handleListToggle = useCallback(() => {
    if (overlaysRef.current.includes(LIST)) closeOverlay(LIST); else openOverlay(LIST);
  }, [openOverlay, closeOverlay]);
  const handleListClose = useCallback(() => { closeOverlay(LIST); }, [closeOverlay]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setParam('q', query);
  }, []);

  // Tag click leaves the recipe and searches the tag. When the close triggers a back
  // navigation the search is deferred until the pop lands, otherwise the popstate
  // handler would overwrite the URL and drop `q`.
  const handleTagClick = useCallback((tag) => {
    if (fullPage) {
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

  // Scroll to a section picked in the drawer. This replaces the 50ms setTimeout
  // TOCNav used to guess with: the wait is not a fixed delay but two real
  // conditions — the owning tab must have rendered (it has, this effect runs
  // after commit) and the drawer must be closed, because it pins
  // `body { overflow: hidden }` while open and closing it can take a back
  // navigation to land. Re-runs when `menuOpen` finally flips.
  useEffect(() => {
    if (!pendingAnchor || menuOpen) return;
    const el = document.getElementById(pendingAnchor);
    setPendingAnchor(null);
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    // Keep history.state (the overlay stack) and ?q= intact — a bare `#id` URL
    // discards both and strands the Back button.
    try {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#${pendingAnchor}`,
      );
    } catch { /* ignore */ }
  }, [pendingAnchor, menuOpen]);

  // Back/forward is the single source of truth for what is on screen: the path
  // says which recipe, `state.overlays` says which layers, `state.page` says
  // card or page. Nothing here decides — it reads the entry we landed on.
  useEffect(() => {
    const onPopState = () => {
      applyOverlays(entryOverlays());
      const key = recipeKeyFromPath(window.location.pathname);
      const recipe = key ? resolveRecipe(key) : null;
      applyRecipe(recipe ? recipe.id : '');
      setPageView(isPageEntry());
      const pending = pendingSearchRef.current;
      if (pending !== null) {
        pendingSearchRef.current = null;
        setSearchQuery(pending);
        setParam('q', pending);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyOverlays, applyRecipe]);

  // A shared link — /r/spicy-pork-patties/ or the legacy ?recipe=Chili — opens
  // straight into a recipe with nothing behind it. Rewrite that first entry to
  // the plain list, then push the recipe on top, so Back has an in-app
  // destination instead of dumping the visitor off the site. That push is also
  // what turns a legacy `?recipe=` link into its `/r/<slug>/` equivalent.
  //
  // `history.state` is the "this entry is ours" marker: a reload preserves it,
  // so re-running would duplicate the entry. A link that resolves to nothing
  // (a stale id, a renamed recipe) just gets its URL cleaned back to the list —
  // being shown the collection beats being shown an error.
  useEffect(() => {
    if (!landing.key || window.history.state) return;
    try {
      window.history.replaceState({ overlays: [], page: false }, '', listUrl());
      if (!landing.id) return;
      window.history.pushState({ overlays: [], page: true }, '', urlForRecipe(landing.id));
    } catch { /* ignore */ }
  }, [landing]);

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

  return (
    <ErrorBoundary>
      <BackToTop />
      <TopBar
        onMenuToggle={handleMenuToggle}
        onListToggle={handleListToggle}
        darkMode={darkMode}
        onToggleDark={toggleDark}
        listItemCount={uncheckedCount}
      />
      <UsdaKeyNotice />
      <TOCNav open={menuOpen} onClose={handleMenuClose} onNavigate={handleNavigateSection} activeTab={activeTab} />
      {fullPage ? (
        // Arrived here from a shared link: there is no list to lay a card over,
        // so the recipe IS the page. Same URL either way.
        <ErrorBoundary key={selectedRecipe.id}>
          <RecipePage
            recipe={selectedRecipe}
            onBackToList={handleCloseModal}
            onTagClick={handleTagClick}
            onAddToList={handleAddToList}
          />
        </ErrorBoundary>
      ) : (
        <>
          <SearchBar ref={searchBarRef} value={searchQuery} onChange={handleSearch} />
          <RecentlyViewed
            history={recentHistory}
            onViewRecipe={handleViewRecipe}
            onClear={clearHistory}
            searchQuery={searchQuery}
          />
          <RecipeList
            onViewRecipe={handleViewRecipe}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <ErrorBoundary key={selectedRecipe?.name ?? '__none__'}>
            <RecipeModal
              recipe={selectedRecipe}
              onClose={handleCloseModal}
              onOpenFullPage={handleOpenFullPage}
              onTagClick={handleTagClick}
              onAddToList={handleAddToList}
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
      <Footer />
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
