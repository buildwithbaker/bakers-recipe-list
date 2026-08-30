import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveRecipe } from './data/recipeIndex.js';
import { TAB_RECIPES } from './data/navSections.js';
import TopBar from './components/TopBar/TopBar.jsx';
import UsdaKeyNotice from './components/UsdaKeyNotice/UsdaKeyNotice.jsx';
import TOCNav from './components/TOCNav/TOCNav.jsx';
import RecipeList from './components/RecipeList/RecipeList.jsx';
import RecipeModal from './components/RecipeModal/RecipeModal.jsx';
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

/*
 * Overlay history model
 * ---------------------
 * Every dismissable layer — recipe card, shopping list, sections menu — pushes a
 * history entry when it opens. The entry's `history.state.overlays` array records
 * the full stack that is open at that entry, so the device/browser Back button
 * pops exactly one layer instead of leaving the site, and Forward restores it.
 *
 * Layers nest: the card's "List" button opens the shopping list on top of the
 * card, so Back closes the list first, then the card, then leaves the site.
 * Only the topmost layer responds to Back / Escape / its own close button —
 * that is what stops a single Escape from closing two stacked layers at once.
 */
const RECIPE_PREFIX = 'recipe:';
const MENU = 'menu';
const LIST = 'list';

function getParam(key) {
  try { return new URLSearchParams(window.location.search).get(key) || ''; }
  catch { return ''; }
}

// Builds a URL string from the current location with `key` set (or removed when falsy).
function urlWithParam(key, value) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value); else params.delete(key);
  const qs = params.toString();
  return qs ? `?${qs}` : window.location.pathname + window.location.hash;
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

// The recipe key carried on the current entry. Now an id for anything this
// build wrote, but an old shared link still carries a name — resolution below
// takes either, so both keep working.
function recipeKeyIn(overlays) {
  const token = overlays.find((t) => t.startsWith(RECIPE_PREFIX));
  return token ? token.slice(RECIPE_PREFIX.length) : '';
}

// Only the recipe card is shareable, so it is the only layer mirrored into the URL.
function urlForOverlays(overlays) {
  return urlWithParam('recipe', recipeKeyIn(overlays));
}

// Resolution order: id, then display name, then raw pre-expansion name, then
// the frozen manifest's legacy name — see resolveRecipe in recipeIndex.js.
// `?recipe=` now emits an id, and every link ever shared still opens.
function findRecipe(key) {
  return resolveRecipe(key);
}

// On first paint: a reload keeps history.state, so trust it. A fresh shared link
// (?recipe=Chili) has no state yet — derive the card from the URL.
function initialOverlays() {
  const fromEntry = entryOverlays();
  if (fromEntry.length) return fromEntry;
  const name = getParam('recipe');
  return name ? [RECIPE_PREFIX + name] : [];
}

function AppInner() {
  const [overlays, setOverlays] = useState(initialOverlays);
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
  // Holds a tag search that must be applied after a back navigation lands.
  const pendingSearchRef = useRef(null);
  const [recentHistory, addToHistory, clearHistory] = useRecentlyViewed();
  const [darkMode, toggleDark] = useDarkMode();
  const [listItems, addListItems, toggleListItem, removeListItem, clearChecked, clearAll] = useShoppingList();

  const selectedRecipe = findRecipe(recipeKeyIn(overlays));
  const menuOpen = overlays.includes(MENU);
  const listOpen = overlays.includes(LIST);

  const applyOverlays = useCallback((next) => {
    overlaysRef.current = next;
    setOverlays(next);
  }, []);

  // Opening a layer PUSHES a history entry, so Back pops the layer, not the site.
  const openOverlay = useCallback((token) => {
    if (overlaysRef.current.includes(token)) return;
    const next = [...overlaysRef.current, token];
    try {
      window.history.pushState({ overlays: next }, '', urlForOverlays(next));
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
    try { window.history.replaceState({ overlays: next }, '', urlForOverlays(next)); } catch { /* ignore */ }
    applyOverlays(next);
    return false;
  }, [applyOverlays]);

  const handleViewRecipe = useCallback((recipe) => {
    openOverlay(RECIPE_PREFIX + recipe.id);
    addToHistory(recipe);
  }, [openOverlay, addToHistory]);

  const closeRecipe = useCallback(() => {
    const key = recipeKeyIn(overlaysRef.current);
    return key ? closeOverlay(RECIPE_PREFIX + key) : false;
  }, [closeOverlay]);

  const handleCloseModal = useCallback(() => { closeRecipe(); }, [closeRecipe]);

  const handleMenuToggle = useCallback(() => {
    if (overlaysRef.current.includes(MENU)) closeOverlay(MENU); else openOverlay(MENU);
  }, [openOverlay, closeOverlay]);
  const handleMenuClose = useCallback(() => { closeOverlay(MENU); }, [closeOverlay]);

  // A drawer entry may belong to another tab, so switch to the tab that renders
  // the section first and record the anchor; the effect below does the scroll
  // once that tab has painted and the drawer is actually gone.
  const handleNavigateSection = useCallback((section) => {
    setActiveTab(section.tab);
    setPendingAnchor(section.id);
    closeOverlay(MENU);
  }, [closeOverlay]);

  const handleListToggle = useCallback(() => {
    if (overlaysRef.current.includes(LIST)) closeOverlay(LIST); else openOverlay(LIST);
  }, [openOverlay, closeOverlay]);
  const handleListClose = useCallback(() => { closeOverlay(LIST); }, [closeOverlay]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setParam('q', query);
  }, []);

  // Tag click closes the card and searches the tag. When the close triggers a back
  // navigation the search is deferred until the pop lands, otherwise the popstate
  // handler would overwrite the URL and drop `q`.
  const handleTagClick = useCallback((tag) => {
    pendingSearchRef.current = tag;
    if (!closeRecipe()) {
      pendingSearchRef.current = null;
      handleSearch(tag);
    }
  }, [closeRecipe, handleSearch]);

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

  // Back/forward is the single source of truth for which layers are open.
  useEffect(() => {
    const onPopState = () => {
      applyOverlays(entryOverlays());
      const pending = pendingSearchRef.current;
      if (pending !== null) {
        pendingSearchRef.current = null;
        setSearchQuery(pending);
        setParam('q', pending);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyOverlays]);

  // A shared link like ?recipe=Chili opens straight into a card with nothing behind it.
  // Rewrite that first entry to the plain list, then push the card on top, so Back has
  // an in-app destination instead of leaving the site. Skipped on reload, where the
  // entry already carries its overlay stack.
  useEffect(() => {
    const name = getParam('recipe');
    if (!name || entryOverlays().length) return;
    try {
      window.history.replaceState({ overlays: [] }, '', urlWithParam('recipe', ''));
      window.history.pushState({ overlays: [RECIPE_PREFIX + name] }, '', urlWithParam('recipe', name));
    } catch { /* ignore */ }
  }, []);

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
          onTagClick={handleTagClick}
          onAddToList={handleAddToList}
        />
      </ErrorBoundary>
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
