import recipes from '../../data/recipes.json';
import styles from './RecentlyViewed.module.css';

// Resolves a name from the recently-viewed history to a full recipe object.
const recipesByName = new Map(recipes.map((r) => [r.name, r]));

// Shows a compact horizontal strip of recently opened recipes. Hidden when
// the history is empty (first visit) or when a search query is active.
export default function RecentlyViewed({ history, onViewRecipe, searchQuery }) {
  if (!history?.length || searchQuery) return null;

  return (
    <div className={styles.strip}>
      <span className={styles.label}>Recently viewed:</span>
      <div className={styles.chips}>
        {history.map((item) => {
          const recipe = recipesByName.get(item.name);
          if (!recipe) return null;
          return (
            <button
              key={item.name}
              type="button"
              className={styles.chip}
              onClick={() => onViewRecipe(recipe)}
              title={item.name}
            >
              {item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
