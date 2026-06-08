import { useDeferredValue, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import recipes from '../../data/recipes.json';
import { SECTIONS } from '../../data/sections.js';
import { expandVersionedRecipe } from '../../data/expandVersions.js';
import SectionBlock from '../SectionBlock/SectionBlock.jsx';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { getEffectiveTags } from '../../utils/autoTags.js';
import styles from './RecipeList.module.css';

// ---------------------------------------------------------------------------
// Module-scope constants
// ---------------------------------------------------------------------------

const recipesBySection = (() => {
  const map = new Map();
  recipes.forEach((recipe) => {
    if (!map.has(recipe.section)) map.set(recipe.section, []);
    map.get(recipe.section).push(recipe);
  });
  return map;
})();

const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

const mainSections   = SECTIONS.filter((s) => !s.review);
const reviewSections = SECTIONS.filter((s) => !!s.review);

const displayedBySection = (() => {
  const map = new Map();
  for (const [key, recs] of recipesBySection) {
    const section = SECTION_BY_KEY.get(key);
    map.set(key, section?.review ? recs.flatMap(expandVersionedRecipe) : recs);
  }
  return map;
})();

// All tags (manual + auto-derived) with counts — computed once at module scope.
const allTagCounts = (() => {
  const counts = new Map();
  recipes.forEach((r) => {
    getEffectiveTags(r).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  });
  // Sort by count desc, then alphabetically.
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalise(s) { return (s || '').toLowerCase(); }

function recipeMatchesQuery(recipe, q) {
  if (recipe.ingredients?.some((ing) => normalise(ing.text).includes(q))) return true;
  if (normalise(recipe.name).includes(q)) return true;
  if (getEffectiveTags(recipe).some((t) => normalise(t).includes(q))) return true;
  if (normalise(recipe.source).includes(q)) return true;
  return false;
}

// sessionStorage key for collapsed sections
const COLLAPSED_KEY = 'brl_collapsed_sections';

// localStorage key for hide-blanks preference
const HIDE_BLANKS_KEY = 'brl_hide_blanks';
function loadHideBlanks() {
  try { return localStorage.getItem(HIDE_BLANKS_KEY) === 'true'; }
  catch { return false; }
}

function loadCollapsed() {
  try {
    const raw = sessionStorage.getItem(COLLAPSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveCollapsed(set) {
  try { sessionStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set])); }
  catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Tag browser modal
// ---------------------------------------------------------------------------

function TagBrowser({ onSelectTag, onClose }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Trap Tab focus inside the dialog while it's open (mirrors RecipeModal).
  useFocusTrap(modalRef, true);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = search.trim()
    ? allTagCounts.filter(([tag]) => tag.toLowerCase().includes(search.toLowerCase()))
    : allTagCounts;

  return (
    <div className={styles.tagOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={modalRef} className={styles.tagModal} role="dialog" aria-modal="true" aria-label="Browse tags">
        <div className={styles.tagModalHeader}>
          <span className={styles.tagModalTitle}>Browse Tags</span>
          <button type="button" className={styles.tagModalClose} onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>
        <div className={styles.tagModalSearch}>
          <input
            ref={inputRef}
            type="search"
            className={styles.tagSearchInput}
            placeholder="Search tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search tags"
          />
        </div>
        <div className={styles.tagCloud}>
          {filtered.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              className={styles.tagPill}
              onClick={() => { onSelectTag(tag); onClose(); }}
            >
              {tag}
              <span className={styles.tagCount}>{count}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className={styles.tagEmpty}>No tags match "{search}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ query, onClear }) {
  return (
    <div className={styles.emptyState}>
      <svg className={styles.emptyIllustration} viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="60" cy="52" rx="38" ry="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M22 52 Q22 72 60 72 Q98 72 98 52" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="44" y1="18" x2="52" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        <line x1="50" y1="16" x2="56" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        <text x="60" y="46" textAnchor="middle" fontSize="18" fill="currentColor" opacity="0.25" fontWeight="700">?</text>
      </svg>
      <p className={styles.emptyTitle}>Nothing found for <strong>"{query}"</strong></p>
      <p className={styles.emptyHint}>Try a different name, tag, or cuisine type.</p>
      {onClear && (
        <button type="button" className={styles.clearFilterBtn} onClick={onClear}>
          × Clear filter
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function ListToolbar({ onRandom, madeFilter, onToggleMadeFilter, hasMade, pinnedFilter, onTogglePinnedFilter, hasPinned, onOpenTags, hideBlanks, onToggleHideBlanks }) {
  return (
    <div className={styles.toolbar}>
      <button type="button" className={styles.randomBtn} onClick={onRandom} title="Open a random recipe">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
        </svg>
        Random
      </button>
      <button type="button" className={styles.randomBtn} onClick={onOpenTags} title="Browse all tags">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
        </svg>
        Tags
      </button>
      {hasPinned && (
        <button
          type="button"
          className={`${styles.filterBtn} ${pinnedFilter ? styles.filterBtnPinned : ''}`}
          onClick={onTogglePinnedFilter}
          title={pinnedFilter ? 'Show all recipes' : 'Show only pinned'}
        >
          {pinnedFilter ? '★ Pinned' : '★ Pinned'}
        </button>
      )}
      {hasMade && (
        <button
          type="button"
          className={`${styles.filterBtn} ${madeFilter !== 'all' ? styles.filterBtnActive : ''}`}
          onClick={onToggleMadeFilter}
          title={madeFilter === 'all' ? 'Show only recipes you\'ve made' : 'Show all recipes'}
        >
          {madeFilter === 'made' ? '✓ Made' : madeFilter === 'unmade' ? '✗ Not made' : 'Filter: Made'}
        </button>
      )}
      <button
        type="button"
        className={`${styles.filterBtn} ${hideBlanks ? styles.filterBtnActive : ''}`}
        onClick={onToggleHideBlanks}
        title={hideBlanks ? 'Show coming soon placeholders' : 'Hide coming soon placeholders'}
      >
        {hideBlanks ? '○ Blanks hidden' : '○ Coming soon'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecipeList({ onViewRecipe, searchQuery, onSearch }) {
  const deferredQuery = useDeferredValue(searchQuery || '');
  const isFiltering = (searchQuery || '') !== deferredQuery;
  const [activeTab, setActiveTab] = useState('recipes');
  const [madeFilter, setMadeFilter] = useState('all');
  const [pinnedFilter, setPinnedFilter] = useState(false);
  const [hideBlanks, setHideBlanks] = useState(loadHideBlanks);
  const [tagBrowserOpen, setTagBrowserOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(loadCollapsed);
  const { madeSet, pinnedSet } = useCookHistoryContext();

  const hasMade   = madeSet.size > 0;
  const hasPinned = pinnedSet.size > 0;

  const handleRandom = () => {
    const pool = [];
    for (const recs of filtered.values()) {
      recs.forEach((r) => { if (!r.is_blank) pool.push(r); });
    }
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onViewRecipe(pick);
  };

  const handleToggleMadeFilter = () => setMadeFilter((v) => v === 'all' ? 'made' : v === 'made' ? 'unmade' : 'all');
  const handleTogglePinnedFilter = () => setPinnedFilter((v) => !v);
  const handleToggleHideBlanks = useCallback(() => {
    setHideBlanks((v) => {
      const next = !v;
      try { localStorage.setItem(HIDE_BLANKS_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback((key) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveCollapsed(next);
      return next;
    });
  }, []);

  const handleSelectTag = useCallback((tag) => {
    onSearch?.(tag);
  }, [onSearch]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const sectionsToSearch = activeTab === 'recipes' ? mainSections : reviewSections;
    const out = new Map();
    for (const section of sectionsToSearch) {
      const displayed = displayedBySection.get(section.key) || [];
      let matches = q ? displayed.filter((r) => recipeMatchesQuery(r, q)) : displayed;
      if (madeFilter === 'made') {
        matches = matches.filter((r) => r.is_blank || madeSet.has(r.name));
      } else if (madeFilter === 'unmade') {
        matches = matches.filter((r) => r.is_blank || !madeSet.has(r.name));
      }
      if (pinnedFilter) {
        matches = matches.filter((r) => r.is_blank || pinnedSet.has(r.name));
      }
      if (hideBlanks) {
        matches = matches.filter((r) => !r.is_blank);
      }
      if (matches.length > 0) out.set(section.key, matches);
    }
    return out;
  }, [deferredQuery, madeFilter, pinnedFilter, hideBlanks, madeSet, pinnedSet, activeTab]);

  const totalFiltered = useMemo(() => {
    let n = 0;
    for (const recs of filtered.values()) n += recs.length;
    return n;
  }, [filtered]);

  const q = deferredQuery.trim();
  const noResults = (q || madeFilter !== 'all' || pinnedFilter) && filtered.size === 0;
  const highlightQuery = q;

  return (
    <main className={isFiltering ? styles.filtering : ''}>
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'recipes' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('recipes')}
        >
          Recipes
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'review' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('review')}
        >
          For Review
        </button>
      </div>
      <ListToolbar
        onRandom={handleRandom}
        madeFilter={madeFilter}
        onToggleMadeFilter={handleToggleMadeFilter}
        hasMade={hasMade}
        pinnedFilter={pinnedFilter}
        onTogglePinnedFilter={handleTogglePinnedFilter}
        hasPinned={hasPinned}
        onOpenTags={() => setTagBrowserOpen(true)}
        hideBlanks={hideBlanks}
        onToggleHideBlanks={handleToggleHideBlanks}
      />
      {q && !noResults && (
        <div className={styles.resultCount}>
          {totalFiltered} recipe{totalFiltered !== 1 ? 's' : ''} matching <strong>"{q}"</strong>
          <button
            type="button"
            className={styles.clearSearchBtn}
            onClick={() => onSearch?.('')}
            aria-label="Clear search"
            title="Clear filter"
          >×</button>
        </div>
      )}
      {noResults && (
        q ? <EmptyState query={q} onClear={() => onSearch?.('')} /> : (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>
              {pinnedFilter ? 'No pinned recipes.' : madeFilter === 'made' ? 'No recipes marked as made yet.' : 'All recipes have been marked as made!'}
            </p>
            <p className={styles.emptyHint}>
              {pinnedFilter ? 'Use the ★ button on any recipe to pin it.' : 'Use the ✓ buttons on any recipe to track what you\'ve cooked.'}
            </p>
          </div>
        )
      )}
      {(activeTab === 'recipes' ? mainSections : reviewSections).map((section) => {
        const displayed = filtered.get(section.key) || [];
        if (displayed.length === 0) return null;
        return (
          <SectionBlock
            key={section.id}
            section={section}
            recipes={displayed}
            onViewRecipe={onViewRecipe}
            hideSource={section.review}
            highlightQuery={highlightQuery}
            collapsed={collapsedSections.has(section.key)}
            onToggleCollapse={handleToggleCollapse}
          />
        );
      })}
      {tagBrowserOpen && (
        <TagBrowser
          onSelectTag={handleSelectTag}
          onClose={() => setTagBrowserOpen(false)}
        />
      )}
    </main>
  );
}
