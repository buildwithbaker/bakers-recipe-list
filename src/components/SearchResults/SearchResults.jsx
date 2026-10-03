// Results for a search across the Cookbook.
import { useMemo } from 'react';
import { ROWS } from '../../data/catalog.js';
import { searchCatalog } from '../../utils/search.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import styles from './SearchResults.module.css';

export default function SearchResults({ query, onViewRecipe, onClear }) {
  const rows = useMemo(() => searchCatalog(ROWS, query), [query]);
  const q = query.trim();

  if (rows.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <h2>No match for “{q}”</h2>
        <p>Search covers recipe names, ingredients and tags.</p>
        <button type="button" className={styles.btn} onClick={onClear}>Clear search</button>
      </div>
    );
  }

  return (
    <>
      <p className={styles.summary} role="status">
        {rows.length} result{rows.length === 1 ? '' : 's'} for “{q}”
      </p>
      <ul className={styles.grid}>
        {rows.map((r) => (
          <RecipeCard key={r.id} recipe={r} onViewRecipe={onViewRecipe} showCategory highlight={q} />
        ))}
      </ul>
    </>
  );
}
