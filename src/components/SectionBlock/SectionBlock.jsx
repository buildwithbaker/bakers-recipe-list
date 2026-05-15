import { memo, useCallback, useRef } from 'react';
import RecipeRow from '../RecipeRow/RecipeRow.jsx';
import { useFlashOnHash } from '../../hooks/useFlashOnHash.js';
import styles from './SectionBlock.module.css';

function SectionBlock({ section, recipes, onViewRecipe, hideSource, highlightQuery }) {
  const headerRef = useRef(null);

  // Flash callback — stable reference so useFlashOnHash's effect doesn't re-run.
  const flash = useCallback(() => {
    if (!headerRef.current) return;
    headerRef.current.classList.remove(styles.flash);
    void headerRef.current.offsetWidth; // force reflow to restart the animation
    headerRef.current.classList.add(styles.flash);
  }, []);

  useFlashOnHash(section.id, flash);

  const headerClass = [
    styles.sectionHeader,
    section.review ? styles.review : '',
  ].filter(Boolean).join(' ');

  // Count non-blank recipes for the badge.
  const realCount = recipes.filter((r) => !r.is_blank).length;
  const totalCount = recipes.length;

  return (
    <div className={styles.sectionBlock} id={section.id}>
      <div ref={headerRef} className={headerClass}>
        {section.label}
        <span className={styles.countBadge} aria-label={`${realCount} recipe${realCount !== 1 ? 's' : ''}`}>
          {realCount}
          {totalCount > realCount && (
            <span className={styles.countTotal}> /{totalCount}</span>
          )}
        </span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Recipe</th>
            <th>Tags</th>
            {!hideSource && <th style={{ width: '100px' }}>Source</th>}
            <th style={{ width: '76px' }}></th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <RecipeRow
              key={recipe.name}
              recipe={recipe}
              onViewRecipe={onViewRecipe}
              hideSource={hideSource}
              highlightQuery={highlightQuery}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(SectionBlock);
