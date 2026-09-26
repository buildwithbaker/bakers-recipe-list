// Results for a search, from all three collections at once, grouped so it is
// always clear which shelf a hit came from.
import { useMemo, useState } from 'react';
import { ROWS_BY_COLLECTION, COLL_BOOK, COLL_REVIEW, COLL_TRY } from '../../data/catalog.js';
import { searchCatalog } from '../../utils/search.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import ToTryLinks from '../ToTryLinks/ToTryLinks.jsx';
import styles from './SearchResults.module.css';

const ALL_ROWS = [...ROWS_BY_COLLECTION[COLL_BOOK], ...ROWS_BY_COLLECTION[COLL_REVIEW], ...ROWS_BY_COLLECTION[COLL_TRY]];
// To Try can return hundreds of links for a common word; show the first batch
// and say how many more there are rather than a wall of links.
const TRY_BATCH = 40;

function Group({ id, title, count, children }) {
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>
        {title}<span className={styles.count}>{count}</span>
      </h2>
      {children}
    </section>
  );
}

export default function SearchResults({ query, onViewRecipe, onClear }) {
  const [showAllTry, setShowAllTry] = useState(false);
  const res = useMemo(() => searchCatalog(ALL_ROWS, query), [query]);
  const q = query.trim();

  if (res.total === 0) {
    return (
      <div className={styles.empty} role="status">
        <h2>No match for “{q}”</h2>
        <p>Search covers recipe names, ingredients, tags and To Try links.</p>
        <button type="button" className={styles.btn} onClick={onClear}>Clear search</button>
      </div>
    );
  }

  const tryRows = showAllTry ? res[COLL_TRY] : res[COLL_TRY].slice(0, TRY_BATCH);

  return (
    <>
      <p className={styles.summary} role="status">
        {res.total} result{res.total === 1 ? '' : 's'} for “{q}”
      </p>
      {res[COLL_BOOK].length > 0 && (
        <Group id="results-book" title="Cookbook" count={res[COLL_BOOK].length}>
          <ul className={styles.grid}>
            {res[COLL_BOOK].map((r) => (
              <RecipeCard key={r.id} recipe={r} onViewRecipe={onViewRecipe} showCategory highlight={q} />
            ))}
          </ul>
        </Group>
      )}
      {res[COLL_REVIEW].length > 0 && (
        <Group id="results-review" title="For Review" count={res[COLL_REVIEW].length}>
          <ul className={styles.grid}>
            {res[COLL_REVIEW].map((r) => (
              <RecipeCard key={r.id} recipe={r} onViewRecipe={onViewRecipe} showCategory showReviewBadge highlight={q} />
            ))}
          </ul>
        </Group>
      )}
      {res[COLL_TRY].length > 0 && (
        <Group id="results-try" title="To Try links" count={res[COLL_TRY].length}>
          <ToTryLinks rows={tryRows} columns highlight={q} />
          {tryRows.length < res[COLL_TRY].length && (
            <button type="button" className={`${styles.btn} ${styles.more}`} onClick={() => setShowAllTry(true)}>
              Show all {res[COLL_TRY].length} To Try links
            </button>
          )}
        </Group>
      )}
    </>
  );
}
