// The recipe as a real page, for a visitor who landed on /r/<slug>/ from a
// shared link with no list behind them. Same route and same body as the modal
// (RecipeView). The difference is the frame: a way back to the collection, and
// related recipes underneath.
//
// data-print-modal is deliberate and must stay: globals.css keys its print
// rules off that attribute, so without it Print from this page emits a blank
// sheet.
import { useId } from 'react';
import styles from './RecipePage.module.css';
import RecipeView from '../RecipeView/RecipeView.jsx';
import RelatedRecipes from '../RelatedRecipes/RelatedRecipes.jsx';
import Icon from '../Icon/Icon.jsx';

export default function RecipePage({ recipe, onBackToList, onTagClick, onAddToList, onViewRelated }) {
  const titleId = useId();
  if (!recipe) return null;

  return (
    <main className={styles.page}>
      <article className={styles.card} aria-labelledby={titleId} data-print-modal>
        <RecipeView
          recipe={recipe}
          titleId={titleId}
          headingLevel={1}
          onTagClick={onTagClick}
          onAddToList={onAddToList}
          barStart={
            <button type="button" className={styles.back} onClick={onBackToList}>
              <Icon name="back" />All recipes
            </button>
          }
          footer={<RelatedRecipes recipe={recipe} onNavigate={onViewRelated} />}
        />
      </article>
    </main>
  );
}
