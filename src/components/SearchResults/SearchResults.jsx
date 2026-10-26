// Results for a search across the Cookbook and Chef's Drafts.
//
// Drafts are searched after the Cookbook, so they come last; each keeps the
// draft pill its card already shows. The mode (Name / Ingredient / All) comes
// from SearchModeContext, provided by App. Each card is told why it matched
// (`matchedLine`, see utils/search.js); a name hit has no line.
import { useContext, useMemo } from 'react';
import { DRAFT_ROWS, ROWS } from '../../data/catalog.js';
import { SEARCH_MODES, searchMatches } from '../../utils/search.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import { SearchModeContext } from './searchModeContext.js';
import styles from './SearchResults.module.css';

const SEARCHED_ROWS = [...ROWS, ...DRAFT_ROWS];

const SCOPE = {
  [SEARCH_MODES.ALL]: { where: '', covers: 'Search covers recipe names, ingredients and tags.' },
  [SEARCH_MODES.NAME]: { where: ' in names', covers: 'Searching recipe names only.' },
  [SEARCH_MODES.INGREDIENT]: { where: ' in ingredients', covers: 'Searching ingredients only.' },
};

export default function SearchResults({ query, onViewRecipe, onClear }) {
  const mode = useContext(SearchModeContext);
  const scope = SCOPE[mode] ?? SCOPE[SEARCH_MODES.ALL];
  const hits = useMemo(() => searchMatches(SEARCHED_ROWS, query, mode), [query, mode]);
  const q = query.trim();

  if (hits.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <h2>No match for “{q}”{scope.where}</h2>
        <p>{scope.covers}</p>
        <button type="button" className={styles.btn} onClick={onClear}>Clear search</button>
      </div>
    );
  }

  return (
    <>
      <p className={styles.summary} role="status">
        {hits.length} result{hits.length === 1 ? '' : 's'} for “{q}”{scope.where}
      </p>
      <ul className={styles.grid}>
        {hits.map(({ recipe, matchedLine }) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onViewRecipe={onViewRecipe}
            showCategory
            highlight={q}
            matchedLine={matchedLine}
          />
        ))}
      </ul>
    </>
  );
}
