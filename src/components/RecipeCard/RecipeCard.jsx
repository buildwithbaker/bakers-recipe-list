// One recipe in a list: a card whose whole surface is the link to the recipe.
//
// The link is a real <a href="/bakers-recipe-list/r/<id>/">, so open-in-new-tab,
// middle-click and long-press-to-share work. A plain click is intercepted and
// opens the recipe as a card over the list, the same as it always has.
//
// Only written recipes get a card. Coming-soon placeholders are counted on
// their category header instead ("N more planned"), and To Try entries are
// links (ToTryLinks).
import { memo } from 'react';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { categoryOf, categoryStyle } from '../../data/catalog.js';
import { photoInitial, recipePhoto } from '../../utils/recipePhoto.js';
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
  const category = categoryOf(recipe);
  const photo = recipePhoto(recipe);
  const title = <Highlight text={recipe.name} query={highlight} />;

  return (
    <li className={styles.card} style={categoryStyle(category)}>
      {/* Decorative: the title beside it names the dish. Width and height are
          set so a photo arriving late cannot shift the layout. */}
      <div className={styles.thumb} aria-hidden="true">
        {photo ? (
          <img src={photo.thumb} alt="" width="88" height="88" loading="lazy" decoding="async" />
        ) : (
          <span>{photoInitial(recipe.name)}</span>
        )}
      </div>
      <div className={styles.body}>
        {showCategory && category && <p className={styles.kicker}>{category.label}</p>}
        <h3 className={styles.title}>
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
        </h3>
        <div className={styles.meta}>
          <span>{plural(ingredientCount(recipe), 'ingredient')} · {plural(stepCount(recipe), 'step')}</span>
          {isMade && (
            <span className={`${styles.pill} ${styles.made}`}>
              <Icon name="check" size={12} />Made
            </span>
          )}
          {showReviewBadge && <span className={`${styles.pill} ${styles.review}`}>For Review</span>}
        </div>
      </div>
      {/* Constant name carrying the recipe, state in aria-pressed and in the
          star's fill: "Pin Pulled Pork, toggle button, pressed". */}
      <button
        type="button"
        className={styles.pin}
        onClick={() => togglePinned(recipe.id)}
        aria-pressed={isPinned}
        aria-label={`Pin ${recipe.name}`}
      >
        <Icon name="star" filled={isPinned} />
      </button>
    </li>
  );
}

export default memo(RecipeCard);
