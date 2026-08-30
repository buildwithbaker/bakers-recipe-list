import { resolveRecipe } from '../../data/recipeIndex.js';
import styles from './RecentlyViewed.module.css';

export default function RecentlyViewed({ history, onViewRecipe, onClear, searchQuery }) {
  if (!history?.length || searchQuery) return null;

  return (
    <div className={styles.strip}>
      <span className={styles.label}>Recently viewed:</span>
      <div className={styles.chips}>
        {history.map((item) => {
          // Entries written before the id migration carry only `name`; the
          // resolver takes either.
          const recipe = resolveRecipe(item.id ?? item.name);
          if (!recipe) return null;
          return (
            <button
              key={item.id ?? item.name}
              type="button"
              className={styles.chip}
              onClick={() => onViewRecipe(recipe)}
              title={recipe.name}
            >
              {recipe.name}
            </button>
          );
        })}
      </div>
      {onClear && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onClear}
          aria-label="Clear recently viewed"
          title="Clear recently viewed"
        >
          Clear
        </button>
      )}
    </div>
  );
}
