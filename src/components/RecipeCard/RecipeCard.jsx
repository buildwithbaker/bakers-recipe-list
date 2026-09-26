// One recipe in a list: a card whose whole surface is the link to the recipe.
//
// The link is a real <a href="/bakers-recipe-list/r/<id>/">, so open-in-new-tab,
// middle-click and long-press-to-share work. A plain click is intercepted and
// opens the recipe as a card over the list, the same as it always has.
//
// A coming-soon placeholder has no page (prerender skips blanks), so it gets a
// button instead of a link: a new tab or a crawler following it would 404.
import { memo } from 'react';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { categoryOf } from '../../data/catalog.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import { recipePath } from '../../utils/recipeRoute.js';
import { ingredientCount, stepCount } from '../../utils/recipeStats.js';
import Icon from '../Icon/Icon.jsx';
import Highlight from '../Highlight/Highlight.jsx';
import styles from './RecipeCard.module.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function RecipeCard({ recipe, onViewRecipe, showCategory = false, showReviewBadge = false, highlight = '' }) {
  const { madeSet, pinnedSet, togglePinned } = useCookHistoryContext();
  const isMade = madeSet.has(recipe.id);
  const isPinned = pinnedSet.has(recipe.id);
  const category = showCategory ? categoryOf(recipe) : null;
  const title = <Highlight text={recipe.name} query={highlight} />;

  return (
    <li className={styles.card}>
      {category && <p className={styles.kicker}>{category.label}</p>}
      <h3 className={styles.title}>
        {recipe.is_blank ? (
          <button type="button" className={styles.link} onClick={() => onViewRecipe(recipe)}>{title}</button>
        ) : (
          <a
            className={styles.link}
            href={recipePath(recipe.id)}
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              e.preventDefault();
              onViewRecipe(recipe);
            }}
          >
            {title}
          </a>
        )}
      </h3>
      <div className={styles.meta}>
        {recipe.is_blank ? (
          <span>Coming soon</span>
        ) : (
          <span>{plural(ingredientCount(recipe), 'ingredient')} · {plural(stepCount(recipe), 'step')}</span>
        )}
        {isMade && (
          <span className={`${styles.pill} ${styles.made}`}>
            <Icon name="check" size={12} />Made
          </span>
        )}
        {showReviewBadge && <span className={`${styles.pill} ${styles.review}`}>For Review</span>}
      </div>
      {!recipe.is_blank && (
        // Constant name carrying the recipe, state in aria-pressed and in the
        // star's fill: "Pin Pulled Pork, toggle button, pressed".
        <button
          type="button"
          className={styles.pin}
          onClick={() => togglePinned(recipe.id)}
          aria-pressed={isPinned}
          aria-label={`Pin ${recipe.name}`}
        >
          <Icon name="star" filled={isPinned} />
        </button>
      )}
    </li>
  );
}

export default memo(RecipeCard);
