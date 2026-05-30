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
import ShoppingList from './components/ShoppingList/ShoppingList.jsx';
import Footer from './components/Footer/Footer.jsx';
import { CookHistoryProvider } from './context/CookHistoryContext.jsx';
import { useRecentlyViewed } from './hooks/useRecentlyViewed.js';
import { useShoppingList } from './hooks/useShoppingList.js';
import { useDarkMode } from './hooks/useDarkMode.js';
import { scaleIngredientText } from './utils/scaleIngredient.js';

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
  const [listOpen, setListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => getParam('q'));
  const searchBarRef = useRef(null);
  const [recentHistory, addToHistory, clearHistory] = useRecentlyViewed();
  const [darkMode, toggleDark] = useDarkMode();
  const [listItems, addListItems, toggleListItem, removeListItem, clearChecked, clearAll] = useShoppingList();

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
  const handleListToggle = useCallback(() => setListOpen((v) => !v), []);
  const handleListClose  = useCallback(() => setListOpen(false), []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setParam('q', query);
  }, []);

  const handleTagClick = useCallback((tag) => {
    handleCloseModal();
    handleSearch(tag);
  }, [handleCloseModal, handleSearch]);

  // Called from RecipeModal's "List" button — adds scaled ingredients to shopping list.
  const handleAddToList = useCallback((recipeName, ingredients, scale) => {
    const texts = ingredients
      .filter((ing) => ing.type === 'item')
      .map((ing) => scaleIngredientText(ing.text, scale));
    addListItems(recipeName, texts);
    setListOpen(true);
  }, [addListItems]);

  // "/" focuses the search bar when the modal is closed.
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
      <TOCNav open={menuOpen} onClose={handleMenuClose} />
      <SearchBar ref={searchBarRef} value={searchQuery} onChange={handleSearch} />
      <RecentlyViewed
        history={recentHistory}
        onViewRecipe={handleViewRecipe}
        onClear={clearHistory}
        searchQuery={searchQuery}
      />
      <RecipeList onViewRecipe={handleViewRecipe} searchQuery={searchQuery} onSearch={handleSearch} />
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
