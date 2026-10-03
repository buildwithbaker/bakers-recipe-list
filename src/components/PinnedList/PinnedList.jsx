// The Pinned tab: every recipe you have starred, as the
// same cards the list uses. "Pinned only" in the Filters sheet still narrows
// the Recipes tab; this is the view for when the pins are the point.
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { resolveAll } from '../Shelves/Shelves.jsx';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';
import Icon from '../Icon/Icon.jsx';
import styles from './PinnedList.module.css';

export default function PinnedList({ onViewRecipe }) {
  const { pinnedSet } = useCookHistoryContext();
  const recipes = resolveAll([...pinnedSet]);
  return (
    <main className={`wrap ${styles.pinned}`}>
      <h2 className={styles.title}>
        Pinned{recipes.length > 0 && <span className={styles.count}>{recipes.length}</span>}
      </h2>
      {recipes.length ? (
        <ul className={styles.grid}>
          {recipes.map((r) => (
            <RecipeCard key={r.id} recipe={r} onViewRecipe={onViewRecipe} showCategory />
          ))}
        </ul>
      ) : (
        <div className={styles.empty}>
          <Icon name="star" />
          <p>Tap the star on any recipe to pin it here.</p>
        </div>
      )}
    </main>
  );
}
