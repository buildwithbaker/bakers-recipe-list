import { useDeferredValue, useMemo } from 'react';
import recipes from '../../data/recipes.json';
import { SECTIONS } from '../../data/sections.js';
import { expandVersionedRecipe } from '../../data/expandVersions.js';
import SectionBlock from '../SectionBlock/SectionBlock.jsx';
import styles from './RecipeList.module.css';

// ---------------------------------------------------------------------------
// Module-scope constants — built once at load time, never recreated.
// ---------------------------------------------------------------------------

// recipes.json is a static import; grouping it once here means RecipeList
// never pays the cost of rebuilding the Map on mount or re-render.
const recipesBySection = (() => {
  const map = new Map();
  recipes.forEach((recipe) => {
    if (!map.has(recipe.section)) map.set(recipe.section, []);
    map.get(recipe.section).push(recipe);
  });
  return map;
})();

// Lookup for section metadata by key, used when expanding versioned recipes.
const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

// Pre-expand versioned review sections once — same stable arrays reused every
// render when search is inactive. Filtering applies to the expanded list so
// every version variant is independently searchable.
const displayedBySection = (() => {
  const map = new Map();
  for (const [key, recs] of recipesBySection) {
    const section = SECTION_BY_KEY.get(key);
    map.set(key, section?.review ? recs.flatMap(expandVersionedRecipe) : recs);
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Pure search helpers — defined at module scope so React never re-allocates them.
// ---------------------------------------------------------------------------

function normalise(s) {
  return (s || '').toLowerCase();
}

function recipeMatchesQuery(recipe, q) {
  if (normalise(recipe.name).includes(q)) return true;
  if (recipe.tags?.some((t) => normalise(t).includes(q))) return true;
  if (normalise(recipe.source).includes(q)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecipeList({ onViewRecipe, searchQuery }) {
  // useDeferredValue keeps the search input responsive while the list re-filters.
  // isFiltering is true for one render cycle while the deferred value catches up.
  const deferredQuery = useDeferredValue(searchQuery || '');
  const isFiltering = (searchQuery || '') !== deferredQuery;

  // Apply the deferred query to produce filtered section maps.
  // When q is empty, return displayedBySection directly (no new allocations).
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return displayedBySection;
    const out = new Map();
    for (const [key, displayed] of displayedBySection) {
      const matches = displayed.filter((r) => recipeMatchesQuery(r, q));
      if (matches.length > 0) out.set(key, matches);
    }
    return out;
  }, [deferredQuery]);

  const totalFiltered = useMemo(() => {
    let n = 0;
    for (const recs of filtered.values()) n += recs.length;
    return n;
  }, [filtered]);

  const q = deferredQuery.trim();
  const noResults = q && filtered.size === 0;

  return (
    <main className={isFiltering ? styles.filtering : ''}>
      {q && !noResults && (
        <div className={styles.resultCount}>
          {totalFiltered} recipe{totalFiltered !== 1 ? 's' : ''} matching <strong>"{q}"</strong>
        </div>
      )}
      {noResults && (
        <div className={styles.noResults}>
          No recipes found for <strong>"{q}"</strong>
        </div>
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
          />
        );
      })}
    </main>
  );
}
