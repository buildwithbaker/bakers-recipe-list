// Recipes related to this one by shared ingredients (utils/relatedRecipes.js,
// the same ranking prerender.mjs uses for the no-JavaScript links). FULL PAGE
// ONLY: in a modal the whole list is already sitting right behind the card.
//
// Every entry is a REAL <a href="/bakers-recipe-list/r/<slug>/"> (RecipeCard):
// that turns the prerendered pages into a graph a crawler can walk, and makes
// middle-click and open-in-new-tab behave the way a link should.
//
// The heading says "More like this", not "More <category>": the ranking is by
// ingredients across every section on purpose (architecture.md §7), so the
// results are often from other categories. Each card names its own.
import { useId, useMemo } from 'react';
import styles from './RelatedRecipes.module.css';
import { displayRecipes } from '../../data/recipeIndex.js';
import { relatedRecipes } from '../../utils/relatedRecipes.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';

export default function RelatedRecipes({ recipe, onNavigate }) {
  const headingId = useId();
  const items = useMemo(() => relatedRecipes(recipe, displayRecipes), [recipe]);

  // Nothing cleared the similarity floor. Padding this out with arbitrary
  // recipes would teach the visitor that the heading means nothing.
  if (items.length === 0) return null;

  return (
    <nav className={styles.related} aria-labelledby={headingId} data-print-hide>
      <h2 id={headingId} className={styles.heading}>More like this</h2>
      {/* Cards show the reader-facing category label, never the staging
          state: no "For Review" badge on a page a shared link opens. */}
      <ul className={styles.grid}>
        {items.map((item) => (
          <RecipeCard key={item.id} recipe={item} onViewRecipe={(r) => onNavigate?.(r)} showCategory />
        ))}
      </ul>
    </nav>
  );
}
