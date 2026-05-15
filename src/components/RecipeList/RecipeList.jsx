import { useDeferredValue, useMemo, useState } from 'react';
import recipes from '../../data/recipes.json';
import { SECTIONS } from '../../data/sections.js';
import { expandVersionedRecipe } from '../../data/expandVersions.js';
import SectionBlock from '../SectionBlock/SectionBlock.jsx';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import styles from './RecipeList.module.css';

// ---------------------------------------------------------------------------
// Module-scope constants — built once at import time, never recreated.
// ---------------------------------------------------------------------------

const recipesBySection = (() => {
  const map = new Map();
  // Filter out is_blank recipes — they're placeholders with no searchable content.
  // They still appear in the list via displayedBySection which includes all recipes.
  recipes.forEach((recipe) => {
    if (!map.has(recipe.section)) map.set(recipe.section, []);
    map.get(recipe.section).push(recipe);
  });
  return map;
})();

const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

// Pre-expand versioned review sections. Blank entries pass through expandVersionedRecipe
// unchanged (no section markers in empty arrays), so no defensive guard needed there.
// Blanks are included so "coming soon" rows appear in the correct sections.
const displayedBySection = (() => {
  const map = new Map();
  for (const [key, recs] of recipesBySection) {
    const section = SECTION_BY_KEY.get(key);
    map.set(key, section?.review ? recs.flatMap(expandVersionedRecipe) : recs);
  }
  return map;
})();

// Flat list of all non-blank recipes for the random picker.
const allReal = recipes.filter((r) => !r.is_blank);

// ---------------------------------------------------------------------------
// Pure helpers — module scope so React never re-allocates them.
// ---------------------------------------------------------------------------

function normalise(s) { return (s || '').toLowerCase(); }

function recipeMatchesQuery(recipe, q) {
  if (normalise(recipe.name).includes(q)) return true;
  if (recipe.tags?.some((t) => normalise(t).includes(q))) return true;
  if (normalise(recipe.source).includes(q)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// No-results illustration
// ---------------------------------------------------------------------------

function EmptyState({ query }) {
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar — random recipe button + made filter toggle
// ---------------------------------------------------------------------------

function ListToolbar({ onRandom, madeFilter, onToggleMadeFilter, hasMade }) {
  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={styles.randomBtn}
        onClick={onRandom}
        title="Open a random recipe"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="16 3 21 3 21 8"/>
          <line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/>
          <line x1="15" y1="15" x2="21" y2="21"/>
        </svg>
        Random
      </button>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecipeList({ onViewRecipe, searchQuery }) {
  const deferredQuery = useDeferredValue(searchQuery || '');
  const isFiltering = (searchQuery || '') !== deferredQuery;
  const [madeFilter, setMadeFilter] = useState('all'); // 'all' | 'made' | 'unmade'
  const { madeSet } = useCookHistoryContext();

  const hasMade = madeSet.size > 0;

  const handleRandom = () => {
    // Pick from the currently filtered pool if a search is active; otherwise all real recipes.
    const pool = [];
    for (const recs of filtered.values()) {
      recs.forEach((r) => { if (!r.is_blank) pool.push(r); });
    }
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onViewRecipe(pick);
  };

  const handleToggleMadeFilter = () => {
    setMadeFilter((v) => v === 'all' ? 'made' : v === 'made' ? 'unmade' : 'all');
  };

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    // displayedBySection is intentionally excluded from deps — it is a module-level
    // constant built at import time and never changes. React lint doesn't flag stable
    // module references; adding it would only add noise to the dep array.
    const out = new Map();
    for (const [key, displayed] of displayedBySection) {
      let matches = q ? displayed.filter((r) => recipeMatchesQuery(r, q)) : displayed;
      // Apply made/unmade filter — only filters real (non-blank) recipes.
      if (madeFilter === 'made') {
        matches = matches.filter((r) => r.is_blank || madeSet.has(r.name));
      } else if (madeFilter === 'unmade') {
        matches = matches.filter((r) => r.is_blank || !madeSet.has(r.name));
      }
      if (matches.length > 0) out.set(key, matches);
    }
    return out;
  }, [deferredQuery, madeFilter, madeSet]);

  const totalFiltered = useMemo(() => {
    let n = 0;
    for (const recs of filtered.values()) n += recs.length;
    return n;
  }, [filtered]);

  const q = deferredQuery.trim();
  const noResults = (q || madeFilter !== 'all') && filtered.size === 0;
  // Pass the raw query string to RecipeRow for name highlighting.
  // Using deferredQuery (not searchQuery) keeps highlighting in sync with filtering.
  const highlightQuery = q;

  return (
    <main className={isFiltering ? styles.filtering : ''}>
      <ListToolbar
        onRandom={handleRandom}
        madeFilter={madeFilter}
        onToggleMadeFilter={handleToggleMadeFilter}
        hasMade={hasMade}
      />
      {q && !noResults && (
        <div className={styles.resultCount}>
          {totalFiltered} recipe{totalFiltered !== 1 ? 's' : ''} matching <strong>"{q}"</strong>
        </div>
      )}
      {noResults && (
        q
          ? <EmptyState query={q} />
          : (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>
                {madeFilter === 'made' ? 'No recipes marked as made yet.' : 'All recipes have been marked as made!'}
              </p>
              <p className={styles.emptyHint}>Use the ✓ buttons on any recipe to track what you've cooked.</p>
            </div>
          )
      )}
      {SECTIONS.map((section) => {
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
          />
        );
      })}
    </main>
  );
}
