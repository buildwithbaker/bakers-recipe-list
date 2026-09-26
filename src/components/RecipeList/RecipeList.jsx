// The browser: pick a collection, narrow to a category, read the cards.
//
// Three collections (data/catalog.js): the Cookbook, For Review (Adam's staging
// shelf, public on purpose) and To Try (links to other sites). Categories are
// chips, and every chip's count is the number of cards that chip shows, so a
// number can never promise rows the list does not have.
//
// A search replaces all of this with SearchResults, which looks across every
// collection at once.
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_BY_ID, COLLECTIONS, COLL_BOOK, COLL_REVIEW, COLL_TRY, categoryStyle, groupByCategory, listedRows, plannedByCategory,
} from '../../data/catalog.js';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { getEffectiveTags } from '../../utils/autoTags.js';
import Icon from '../Icon/Icon.jsx';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import ToTryLinks from '../ToTryLinks/ToTryLinks.jsx';
import SearchResults from '../SearchResults/SearchResults.jsx';
import FiltersSheet from '../FiltersSheet/FiltersSheet.jsx';
import Shelves from '../Shelves/Shelves.jsx';

// The Filters sheet offers this many of a collection's most-used tags.
const TOP_TAGS = 24;
import styles from './RecipeList.module.css';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecipeList({
  onViewRecipe, searchQuery, onSearch, collection, onCollectionChange, category, onCategoryChange,
  recentHistory = [], onClearRecent,
}) {
  const deferredQuery = useDeferredValue(searchQuery || '');
  const isFiltering = (searchQuery || '') !== deferredQuery;
  const [madeFilter, setMadeFilter] = useState('all');
  const [pinnedFilter, setPinnedFilter] = useState(false);
  const [tagFilter, setTagFilter] = useState(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { madeSet, pinnedSet } = useCookHistoryContext();
  const chipRowRef = useRef(null);
  const filtersBtnRef = useRef(null);

  const isTry = collection === COLL_TRY;
  const activeFilters = (pinnedFilter ? 1 : 0) + (madeFilter !== 'all' ? 1 : 0) + tagFilter.size;

  // Tags filter per collection: a tag chosen in the Cookbook means nothing in
  // For Review, so switching collection clears them.
  useEffect(() => { setTagFilter(new Set()); }, [collection]);

  // The collection's most-used tags, counted over everything it lists. A tag
  // on a single recipe is not worth a filter; search finds it.
  const topTags = useMemo(() => {
    const counts = new Map();
    for (const r of listedRows(collection)) {
      for (const t of getEffectiveTags(r)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_TAGS);
  }, [collection]);

  // The collection's rows after the made / pinned filters. Coming-soon
  // placeholders are never listed: each category header says how many more
  // are planned instead. The category chips are counted from THIS list, so
  // each chip's number is what tapping it shows. To Try ignores made and
  // pinned: links have neither.
  const base = useMemo(() => {
    let rows = listedRows(collection);
    if (isTry) return rows;
    if (madeFilter === 'made') rows = rows.filter((r) => madeSet.has(r.id));
    else if (madeFilter === 'unmade') rows = rows.filter((r) => !madeSet.has(r.id));
    if (pinnedFilter) rows = rows.filter((r) => pinnedSet.has(r.id));
    for (const tag of tagFilter) rows = rows.filter((r) => getEffectiveTags(r).includes(tag));
    return rows;
  }, [collection, isTry, madeFilter, pinnedFilter, tagFilter, madeSet, pinnedSet]);
  const planned = useMemo(() => plannedByCategory(collection), [collection]);

  const groups = useMemo(() => groupByCategory(base), [base]);
  const shownGroups = category ? groups.filter((g) => g.category?.id === category) : groups;
  const shownCount = shownGroups.reduce((n, g) => n + g.rows.length, 0);

  // Keep a chip for the selected category even when a filter empties it, so
  // there is always a visible way to deselect it.
  const chips = groups.map((g) => ({ category: g.category, id: g.category.id, label: g.category.label, n: g.rows.length }));
  const selectedMissing = category && !chips.some((c) => c.id === category);

  // Counts on the collection switcher: what each collection lists, unfiltered.
  const collectionCount = (key) => listedRows(key).length;

  // On a phone the chip row scrolls sideways: keep the pressed chip in view by
  // moving the row, never the page.
  useEffect(() => {
    const row = chipRowRef.current;
    const active = row?.querySelector('[aria-pressed="true"][data-cat]');
    if (!row || !active || row.scrollWidth <= row.clientWidth) return;
    const left = active.offsetLeft - row.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < row.scrollLeft) row.scrollLeft = left - 16;
    else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth + 16;
  }, [category, collection]);

  const handleRandom = () => {
    const pool = shownGroups.flatMap((g) => g.rows);
    if (!pool.length) return;
    onViewRecipe(pool[Math.floor(Math.random() * pool.length)]);
  };

  const clearFilters = useCallback(() => {
    setMadeFilter('all');
    setPinnedFilter(false);
    setTagFilter(new Set());
  }, []);

  const toggleTag = useCallback((tag) => {
    setTagFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }, []);

  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  // Tags chosen but outside the top list stay visible in the sheet, so a
  // filter that is on can always be turned off.
  const sheetTags = [
    ...[...tagFilter].filter((t) => !topTags.some(([x]) => x === t)).map((t) => [t, 0]),
    ...topTags,
  ];
  const showShelves = collection === COLL_BOOK && !category && activeFilters === 0;

  const q = deferredQuery.trim();
  if (q) {
    return (
      <main className={isFiltering ? styles.filtering : ''}>
        <SearchResults query={deferredQuery} onViewRecipe={onViewRecipe} onClear={() => onSearch?.('')} />
      </main>
    );
  }

  return (
    <main className={isFiltering ? styles.filtering : ''}>
      {/* A view switcher, exposed as pressed buttons rather than an ARIA
          tablist: role="tab" promises arrow-key focus movement and linked tab
          panels, and a widget that announces a contract it does not keep is
          worse than a plain button that says what it is. */}
      <div className={styles.collections} role="group" aria-label="Collections">
        {COLLECTIONS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={collection === c.key}
            onClick={() => onCollectionChange(c.key)}
          >
            {c.label}<span className={styles.n}>{collectionCount(c.key)}</span>
          </button>
        ))}
      </div>

      <div className={styles.chipRow} ref={chipRowRef} role="group" aria-label="Categories and filters">
        <button
          type="button"
          className={styles.chip}
          data-cat=""
          aria-pressed={!category}
          onClick={() => onCategoryChange('')}
        >
          All<span className={styles.n}>{base.length}</span>
        </button>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.chip}
            style={categoryStyle(c.category)}
            data-cat={c.id}
            aria-pressed={category === c.id}
            onClick={() => onCategoryChange(category === c.id ? '' : c.id)}
          >
            <span className={styles.dot} aria-hidden="true" />
            {c.label}<span className={styles.n}>{c.n}</span>
          </button>
        ))}
        {selectedMissing && (
          <button type="button" className={styles.chip} data-cat={category} aria-pressed onClick={() => onCategoryChange('')}>
            {CATEGORY_BY_ID.get(category)?.label ?? category}<span className={styles.n}>0</span>
          </button>
        )}
        {!isTry && (
          <>
            <button
              ref={filtersBtnRef}
              type="button"
              className={`${styles.chip} ${styles.tool}`}
              aria-haspopup="dialog"
              aria-pressed={activeFilters > 0}
              onClick={() => setFiltersOpen(true)}
            >
              <Icon name="filter" />{activeFilters ? `Filters · ${activeFilters}` : 'Filters'}
            </button>
            <button type="button" className={`${styles.chip} ${styles.tool}`} onClick={handleRandom}>
              <Icon name="shuffle" />Surprise me
            </button>
          </>
        )}
      </div>

      {showShelves && (
        <Shelves pinnedIds={pinnedSet} recent={recentHistory} onViewRecipe={onViewRecipe} onClearRecent={onClearRecent} />
      )}

      {collection === COLL_REVIEW && (
        <p className={styles.note}>For Review holds written recipes that have not been cooked and signed off yet.</p>
      )}
      {isTry && (
        <p className={styles.note}>To Try is a reading list: links to other sites, saved to cook later. They open in a new tab.</p>
      )}

      {shownCount === 0 && (
        <div className={styles.empty} role="status">
          <h2>Nothing matches</h2>
          <p>No recipes fit these filters.</p>
          <button type="button" className={styles.btn} onClick={() => { clearFilters(); onCategoryChange(''); }}>
            Clear filters
          </button>
        </div>
      )}

      {shownGroups.map((g) => (
        <section
          key={g.category.id}
          className={styles.group}
          style={categoryStyle(g.category)}
          aria-labelledby={`g-${g.category.id}`}
        >
          {/* A recipe-box divider tab on a rule in the category colour. */}
          <div className={styles.groupHead}>
            <h2 id={`g-${g.category.id}`}>
              {g.category.label}<span className={styles.n}>{g.rows.length}</span>
            </h2>
            {planned.get(g.category.id) > 0 && (
              <span className={styles.soon}>{planned.get(g.category.id)} more planned</span>
            )}
          </div>
          {isTry ? (
            <ToTryLinks rows={g.rows} columns />
          ) : (
            <ul className={styles.grid}>
              {g.rows.map((r) => <RecipeCard key={r.id} recipe={r} onViewRecipe={onViewRecipe} />)}
            </ul>
          )}
        </section>
      ))}

      {filtersOpen && (
        <FiltersSheet
          onClose={closeFilters}
          returnFocusRef={filtersBtnRef}
          resultCount={shownCount}
          pinnedOnly={pinnedFilter}
          onTogglePinned={() => setPinnedFilter((v) => !v)}
          made={madeFilter}
          onMadeChange={setMadeFilter}
          tags={sheetTags}
          selectedTags={tagFilter}
          onToggleTag={toggleTag}
          onClearAll={clearFilters}
        />
      )}
    </main>
  );
}
