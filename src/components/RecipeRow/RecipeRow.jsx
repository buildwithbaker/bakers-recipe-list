import { memo } from 'react';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import { getEffectiveTags } from '../../utils/autoTags.js';
import { isToTry } from '../../utils/recipeKinds.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import { recipePath } from '../../utils/recipeRoute.js';
import styles from './RecipeRow.module.css';

function HighlightedText({ text, query }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.highlight}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function RecipeRow({ recipe, onViewRecipe, hideSource, highlightQuery }) {
  const { madeSet, toggleMade, cookLog, pinnedSet, togglePinned } = useCookHistoryContext();
  // Keyed by id, not name: an expanded row's name renumbers when its record
  // gains a version, and `id` does not.
  const isMade   = madeSet.has(recipe.id);
  const isPinned = pinnedSet.has(recipe.id);
  const hasNotes = !!(cookLog[recipe.id]?.notes?.trim());

  const tags = getEffectiveTags(recipe).join(' ');

  // "To Try" card: name + external "View source" link, no coming-soon/made/pin UI.
  if (isToTry(recipe)) {
    return (
      <tr className={`${styles.row} ${styles.toTryRow}`}>
        <td className={styles.recipeName}>
          <HighlightedText text={recipe.name} query={highlightQuery} />
          <span className={styles.toTryBadge}>to try</span>
        </td>
        <td className={styles.recipeTags}>{tags}</td>
        {!hideSource && <td className={styles.recipeSource} />}
        <td className={styles.actionCell}>
          <a
            className={styles.sourceLink}
            href={recipe.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            View source ↗
          </a>
        </td>
      </tr>
    );
  }

  const rowClass = [
    styles.row,
    recipe.is_blank ? styles.blankRow : '',
    isMade          ? styles.madeRow  : '',
    isPinned        ? styles.pinnedRow : '',
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowClass}>
      <td className={styles.recipeName}>
        {isMade && <span className={styles.madeDot} aria-label="Made">✓</span>}
        {/* The name IS the way in. A real link to the recipe's own page, so
            open-in-new-tab, middle-click and long-press-to-share all work; a
            plain click opens the card over the list, as the old View button
            did. On a phone the name is the obvious thing to tap - it used to
            do nothing, and the only way in was a small button beside Made. */}
        {/* A coming-soon placeholder has no prerendered page (prerender skips
            blanks), so it gets no href - a link would only lead a new tab or
            a crawler to a 404. It still opens its card. */}
        {recipe.is_blank ? (
          <button
            type="button"
            className={`${styles.nameLink} ${styles.nameBtn}`}
            onClick={() => onViewRecipe(recipe)}
          >
            <HighlightedText text={recipe.name} query={highlightQuery} />
          </button>
        ) : (
          <a
            className={styles.nameLink}
            href={recipePath(recipe.id)}
            onClick={(e) => {
              if (isModifiedClick(e)) return;
              e.preventDefault();
              onViewRecipe(recipe);
            }}
          >
            <HighlightedText text={recipe.name} query={highlightQuery} />
          </a>
        )}
        {recipe.is_blank && <span className={styles.blankBadge}>coming soon</span>}
        {hasNotes && (
          <span className={styles.noteIcon} title="Has notes" aria-label="Has notes">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </span>
        )}
      </td>
      <td className={styles.recipeTags}>{tags}</td>
      {/* Capped and ellipsised so one long note cannot widen its whole table;
          the full text stays in the tooltip. */}
      {!hideSource && (
        <td className={styles.recipeSource}>
          {recipe.source && <span className={styles.sourceText} title={recipe.source}>{recipe.source}</span>}
        </td>
      )}
      <td className={styles.actionCell}>
        {!recipe.is_blank && (
          <>
            {/* Toggles: the state is aria-pressed and the glyph's SHAPE (outline
                vs filled star, circle vs check), not just colour - so it
                survives grayscale and needs no hover tooltip on a phone. The
                name is constant and carries the recipe, so a screen reader
                hears "Pin Pulled Pork, toggle button, pressed" rather than
                twelve identical "Pin recipe" buttons. */}
            <button
              type="button"
              className={`${styles.pinBtn} ${isPinned ? styles.pinBtnActive : ''}`}
              onClick={() => togglePinned(recipe.id)}
              aria-pressed={isPinned}
              aria-label={`Pin ${recipe.name}`}
              title={isPinned ? 'Pinned — click to unpin' : 'Pin for later'}
            >
              <span aria-hidden="true">{isPinned ? '★' : '☆'}</span>
            </button>
            <button
              type="button"
              className={`${styles.madeBtn} ${isMade ? styles.madeBtnActive : ''}`}
              onClick={() => toggleMade(recipe.id)}
              aria-pressed={isMade}
              aria-label={`Made ${recipe.name}`}
              title={isMade ? 'Made — click to unmark' : 'Mark as made'}
            >
              <span aria-hidden="true">{isMade ? '✓' : '○'}</span>
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default memo(RecipeRow);
