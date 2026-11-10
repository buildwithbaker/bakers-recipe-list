// "Make it a meal": the hand-picked recipes that go with this one
// (src/data/mealSets.json, utils/mealSets.js). FULL PAGE ONLY: in a modal the
// whole list is already sitting right behind the card.
//
// One block per set the recipe is in. Every card is the existing RecipeCard,
// a real <a href="/bakers-recipe-list/r/<slug>/">, so the prerendered pages
// stay a graph a crawler can walk and middle-click works. A recipe in no set
// renders nothing.
import { useMemo } from 'react';
import styles from './MealSets.module.css';
import { mealBlocksFor } from '../../utils/mealSets.js';
import RecipeCard from '../RecipeCard/RecipeCard.jsx';

function Block({ set, others, onNavigate }) {
  return (
    <nav className={styles.related} aria-label={set.name} data-print-hide>
      <h2 className={styles.heading}>Make it a meal</h2>
      <p className={styles.line}>{set.name} · {set.recipes.length} recipes made to go together</p>
      <ul className={styles.grid}>
        {others.map((item) => (
          <RecipeCard key={item.id} recipe={item} onViewRecipe={(r) => onNavigate?.(r)} showCategory />
        ))}
      </ul>
    </nav>
  );
}

export default function MealSets({ recipe, onNavigate }) {
  const blocks = useMemo(() => mealBlocksFor(recipe.id), [recipe.id]);
  if (blocks.length === 0) return null;
  return blocks.map((b) => <Block key={b.set.id} set={b.set} others={b.others} onNavigate={onNavigate} />);
}
