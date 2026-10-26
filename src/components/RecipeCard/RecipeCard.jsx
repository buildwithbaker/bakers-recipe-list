// One recipe in a list: a card whose whole surface is the link to the recipe.
//
// The link is a real <a href="/bakers-recipe-list/r/<id>/">, so open-in-new-tab,
// middle-click and long-press-to-share work. A plain click is intercepted and
// opens the recipe as a card over the list, the same as it always has.
//
// Only written recipes get a card. Coming-soon placeholders are counted on
// their category header instead ("N more planned").
import { memo } from 'react';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { categoryOf, categoryStyle } from '../../data/catalog.js';
import { DRAFT_LABEL, isDraft } from '../../data/sections.js';
import { photoInitial, recipePhoto } from '../../utils/recipePhoto.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import { recipePath } from '../../utils/recipeRoute.js';
import { isNew } from '../../utils/autoTags.js';
import { ingredientCount, stepCount } from '../../utils/recipeStats.js';
import Icon from '../Icon/Icon.jsx';
import Highlight from '../Highlight/Highlight.jsx';
import styles from './RecipeCard.module.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function RecipeCard({ recipe, onViewRecipe, showCategory = false, highlight = '' }) {
  const { madeSet, pinnedSet, togglePinned } = useCookHistoryContext();
  const isMade = madeSet.has(recipe.id);
  const isPinned = pinnedSet.has(recipe.id);
  const category = categoryOf(recipe);
  const photo = recipePhoto(recipe);
  const title = <Highlight text={recipe.name} query={highlight} />;
  // NEW for 14 days after `added`, judged in Central time at render (autoTags.js).
  const fresh = isNew(recipe);
  const kicker = showCategory && category;

  return (
    <li className={styles.card} style={categoryStyle(category)}>
      {/* Decorative: the title beside it names the dish. Width and height are
          set so a photo arriving late cannot shift the layout. No AI badge
          here: an AI photo is labelled on its recipe (RecipeView). */}
      <div className={styles.thumb}>
        {photo ? (
          <img src={photo.thumb} alt="" width="88" height="88" loading="lazy" decoding="async" />
        ) : (
          <span className={styles.initial} aria-hidden="true">{photoInitial(recipe.name)}</span>
        )}
      </div>
      <div className={styles.body}>
        {(fresh || kicker) && (
          <div className={styles.top}>
            {fresh && <span className={`${styles.pill} ${styles.new}`}>New</span>}
            {kicker && <p className={styles.kicker}>{category.label}</p>}
          </div>
        )}
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
          {isDraft(recipe) && <span className={`${styles.pill} ${styles.draft}`}>{DRAFT_LABEL}</span>}
          {isMade && (
            <span className={`${styles.pill} ${styles.made}`}>
              <Icon name="check" size={12} />Made
            </span>
          )}
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
