import { useCallback, useEffect, useRef, useState } from 'react';
import recipes from './data/recipes.json';
import TopBar from './components/TopBar/TopBar.jsx';
import UsdaKeyNotice from './components/UsdaKeyNotice/UsdaKeyNotice.jsx';
import TOCNav from './components/TOCNav/TOCNav.jsx';
import RecipeList from './components/RecipeList/RecipeList.jsx';
import RecipeModal from './components/RecipeModal/RecipeModal.jsx';
import SearchBar from './components/SearchBar/SearchBar.jsx';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary.jsx';
import RecentlyViewed from './components/RecentlyViewed/RecentlyViewed.jsx';
import BackToTop from './components/BackToTop/BackToTop.jsx';
import { CookHistoryProvider } from './context/CookHistoryContext.jsx';
import { useRecentlyViewed } from './hooks/useRecentlyViewed.js';

function getParam(key) {
  try { return new URLSearchParams(window.location.search).get(key) || ''; }
  catch { return ''; }
}

function setParam(key, value) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value); else params.delete(key);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname + window.location.hash);
  } catch { /* ignore */ }
}

function AppInner() {
  const [selectedRecipe, setSelectedRecipe] = useState(() => {
    const name = getParam('recipe');
    return name ? (recipes.find((r) => r.name === name) ?? null) : null;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => getParam('q'));
  const searchBarRef = useRef(null);
  const [recentHistory, addToHistory, clearHistory] = useRecentlyViewed();

  const handleViewRecipe = useCallback((recipe) => {
    setSelectedRecipe(recipe);
    setParam('recipe', recipe.name);
    addToHistory(recipe);
  }, [addToHistory]);

  const handleCloseModal = useCallback(() => {
    setSelectedRecipe(null);
    setParam('recipe', '');
  }, []);

  const handleMenuToggle = useCallback(() => setMenuOpen((v) => !v), []);
  const handleMenuClose  = useCallback(() => setMenuOpen(false), []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setParam('q', query);
  }, []);

  const handleTagClick = useCallback((tag) => {
    handleCloseModal();
    handleSearch(tag);
  }, [handleCloseModal, handleSearch]);

  // "/" focuses the search bar when the modal is closed and focus isn't
  // already inside an input/textarea.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/') return;
      if (selectedRecipe) return;
      const active = document.activeElement;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      searchBarRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedRecipe]);

  return (
    <ErrorBoundary>
      <BackToTop />
      <TopBar onMenuToggle={handleMenuToggle} />
      <UsdaKeyNotice />
      <TOCNav open={menuOpen} onClose={handleMenuClose} />
      <SearchBar ref={searchBarRef} value={searchQuery} onChange={handleSearch} />
      <RecentlyViewed
        history={recentHistory}
        onViewRecipe={handleViewRecipe}
        onClear={clearHistory}
        searchQuery={searchQuery}
      />
      <RecipeList onViewRecipe={handleViewRecipe} searchQuery={searchQuery} />
      {/* key resets ErrorBoundary per recipe so one bad modal doesn't block others */}
      <ErrorBoundary key={selectedRecipe?.name ?? '__none__'}>
        <RecipeModal recipe={selectedRecipe} onClose={handleCloseModal} onTagClick={handleTagClick} />
      </ErrorBoundary>
    </ErrorBoundary>
  );
}

// CookHistoryProvider wraps the entire app so RecipeRow can useContext directly —
// no prop drilling through RecipeList or SectionBlock, preserving their memos.
export default function App() {
  return (
    <CookHistoryProvider>
      <AppInner />
    </CookHistoryProvider>
  );
}
