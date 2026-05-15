import { memo } from 'react';
import { useCookHistoryContext } from '../../context/CookHistoryContext.jsx';
import styles from './RecipeRow.module.css';

// Highlights the first occurrence of `query` inside `text` using a <mark> element.
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
  // Reads directly from context — SectionBlock never receives madeSet as a prop,
  // so SectionBlock's memo is never busted by a toggle.
  const { madeSet, toggleMade } = useCookHistoryContext();
  const isMade = madeSet.has(recipe.name);

  const rowClass = [
    recipe.is_blank ? styles.blankRow : '',
    isMade ? styles.madeRow : '',
  ].filter(Boolean).join(' ');

  const tags = recipe.tags?.length ? recipe.tags.join(' ') : '';

  return (
    <tr className={rowClass}>
      <td className={styles.recipeName}>
        {isMade && <span className={styles.madeDot} aria-label="Made">✓</span>}
        <HighlightedText text={recipe.name} query={highlightQuery} />
        {recipe.is_blank && <span className={styles.blankBadge}>coming soon</span>}
      </td>
      <td className={styles.recipeTags}>{tags}</td>
      {!hideSource && <td className={styles.recipeSource}>{recipe.source || ''}</td>}
      <td className={styles.actionCell}>
        {!recipe.is_blank && (
          <button
            type="button"
            className={`${styles.madeBtn} ${isMade ? styles.madeBtnActive : ''}`}
            onClick={() => toggleMade(recipe.name)}
            aria-label={isMade ? 'Mark as not made' : 'Mark as made'}
            title={isMade ? 'Unmark' : 'Made it!'}
          >
            {isMade ? '✓' : '○'}
          </button>
        )}
        <button
          type="button"
          className={styles.viewBtn}
          onClick={() => onViewRecipe(recipe)}
        >
          View
        </button>
      </td>
    </tr>
  );
}

export default memo(RecipeRow);
