// The recipe as a real page, for a visitor who landed on /r/<slug>/ from a
// shared link with no list behind them. Same route and same body as the modal
// (RecipeView) — the difference is the frame: a hero photo, a way back to the
// collection, and no backdrop to dismiss.
//
// data-print-modal is deliberate and must stay: globals.css keys its print
// rules off that attribute, so without it Print from this page emits a blank
// sheet.
import { useId } from 'react';
import styles from './RecipePage.module.css';
import RecipeView from '../RecipeView/RecipeView.jsx';
import { BASE_PATH } from '../../utils/recipeRoute.js';

// Until a recipe carries its own photo (`image` arrives with the schema patch)
// every page shows the shared brand placeholder — the same file the prerendered
// og:image points at, so the preview and the page agree.
const PLACEHOLDER = `${BASE_PATH}recipe-placeholder.png`;

export default function RecipePage({ recipe, onBackToList, onTagClick, onAddToList }) {
  const titleId = useId();
  if (!recipe) return null;

  const heroSrc = recipe.image ? `${BASE_PATH}${String(recipe.image).replace(/^\/+/, '')}` : PLACEHOLDER;

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
          onTagClick={onTagClick}
          onAddToList={onAddToList}
          hero={
            <div className={styles.hero}>
              <img className={styles.heroImg} src={heroSrc} alt="" width="1200" height="630" />
            </div>
          }
        />
      </article>
    </main>
  );
}
