// One recipe in a list: a card whose whole surface is the link to the recipe.
//
// The link is a real <a href="/bakers-recipe-list/r/<id>/">, so open-in-new-tab,
// middle-click and long-press-to-share work. A plain click is intercepted and
// opens the recipe as a card over the list, the same as it always has.
//
// Only written recipes get a card. Coming-soon placeholders are counted on
// their category header instead ("N more planned").
//
// Layout (Option A, 2026-10-25), top to bottom: photo, the top row (NEW, the
// category kicker, the draft and Made pills), title and pin; the ready time
// with the hands-on time beside it; "Plan ahead" when the recipe has a wait;
// the description, two lines at most; then up to three tag chips. Difficulty
// and the ingredient/step counts are not on the card.
import { memo } from 'react';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { categoryOf, categoryStyle } from '../../data/catalog.js';
import { DRAFT_LABEL, isDraft } from '../../data/sections.js';
import { photoInitial, recipePhoto } from '../../utils/recipePhoto.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import { recipePath } from '../../utils/recipeRoute.js';
import { getEffectiveTags, isNew } from '../../utils/autoTags.js';
import { formatMinutes, isoToMinutes, recipeTimes } from '../../utils/isoDuration.js';
import Icon from '../Icon/Icon.jsx';
import Highlight from '../Highlight/Highlight.jsx';
import { cardChips, chipLabel } from './cardChips.js';
import styles from './RecipeCard.module.css';

// Hourglass for the Plan ahead line. Decorative: the words carry it.
const hourglass = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" />
  </svg>
);

/**
 * @param {object} props
 * @param {string} [props.matchedLine] search only: the line the query matched,
 *   shown as "matched: <line>" under the description.
 */
function RecipeCard({ recipe, onViewRecipe, showCategory = false, highlight = '', matchedLine }) {
  const { madeSet, pinnedSet, togglePinned } = useCookHistoryContext();
  const isMade = madeSet.has(recipe.id);
  const isPinned = pinnedSet.has(recipe.id);
  const category = categoryOf(recipe);
  const photo = recipePhoto(recipe);
  const title = <Highlight text={recipe.name} query={highlight} />;
  // NEW for 14 days after `added`, judged in Central time at render (autoTags.js).
  const fresh = isNew(recipe);
  const kicker = showCategory && category;
  const draft = isDraft(recipe);
  const times = recipeTimes(recipe);
  const wait = isoToMinutes(recipe.waitTime);
  const chips = cardChips(getEffectiveTags(recipe), category?.label);

  return (
    <li className={styles.card} style={categoryStyle(category)}>
      <div className={styles.head}>
        {/* Decorative: the title beside it names the dish. Width and height are
            set so a photo arriving late cannot shift the layout. No AI badge
            here: an AI photo is labelled on its recipe (RecipeView). */}
        <div className={styles.thumb}>
          {photo ? (
            <img src={photo.thumb} alt="" width="56" height="56" loading="lazy" decoding="async" />
          ) : (
            <span className={styles.initial} aria-hidden="true">{photoInitial(recipe.name)}</span>
          )}
        </div>
        <div className={styles.heading}>
          {(fresh || kicker || draft || isMade) && (
            <div className={styles.top}>
              {fresh && <span className={`${styles.pill} ${styles.new}`}>New</span>}
              {kicker && <p className={styles.kicker}>{category.label}</p>}
              {draft && <span className={`${styles.pill} ${styles.draft}`}>{DRAFT_LABEL}</span>}
              {isMade && (
                <span className={`${styles.pill} ${styles.made}`}>
                  <Icon name="check" size={12} />Made
                </span>
              )}
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
        </div>
      </div>
      {times && (
        <p className={styles.time}>
          <Icon name="clock" size={18} />
          <strong>{formatMinutes(times.ready)}</strong>
          <span className={styles.handsOn}>{` · ${formatMinutes(times.handsOn)} hands-on`}</span>
        </p>
      )}
      {wait > 0 && (
        <p className={styles.plan}>
          {hourglass}
          <span>{`Plan ahead: ${recipe.waitLabel || formatMinutes(wait)}`}</span>
        </p>
      )}
      {recipe.description && <p className={styles.desc}>{recipe.description}</p>}
      {matchedLine && (
        <p className={styles.matched}>matched: <Highlight text={matchedLine} query={highlight} /></p>
      )}
      {chips.length > 0 && (
        <ul className={styles.chips}>
          {chips.map((t) => <li key={t} className={styles.chip}>{chipLabel(t)}</li>)}
        </ul>
      )}
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
