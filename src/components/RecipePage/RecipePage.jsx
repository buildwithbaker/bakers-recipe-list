// The recipe as a real page, for a visitor who landed on /r/<slug>/ from a
// shared link with no list behind them. Same route and same body as the modal
// (RecipeView) — the difference is the frame: a way back to the collection, and
// no backdrop to dismiss.
//
// The hero is RecipeView's to render. This frame only decides what an
// UNPHOTOGRAPHED recipe gets: the placeholder, because a page opening on a bare
// title line reads as broken in a way a card over a list does not.
//
// data-print-modal is deliberate and must stay: globals.css keys its print
// rules off that attribute, so without it Print from this page emits a blank
// sheet.
import { useId } from 'react';
import styles from './RecipePage.module.css';
import RecipeView from '../RecipeView/RecipeView.jsx';
import RelatedRecipes from '../RelatedRecipes/RelatedRecipes.jsx';

export default function RecipePage({ recipe, onBackToList, onTagClick, onAddToList, onViewRelated }) {
  const titleId = useId();
  if (!recipe) return null;

  return (
    <main className={styles.page}>
      <button type="button" className={styles.backLink} onClick={onBackToList}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        All recipes
      </button>
      <article className={styles.card} aria-labelledby={titleId} data-print-modal>
        <RecipeView
          recipe={recipe}
          titleId={titleId}
          showPlaceholderHero
          onTagClick={onTagClick}
          onAddToList={onAddToList}
        />
      </article>
      <RelatedRecipes recipe={recipe} onNavigate={onViewRelated} />
    </main>
  );
}
