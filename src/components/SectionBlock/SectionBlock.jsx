import { memo, useCallback, useRef } from 'react';
import RecipeRow from '../RecipeRow/RecipeRow.jsx';
import { useFlashOnHash } from '../../hooks/useFlashOnHash.js';
import styles from './SectionBlock.module.css';

function SectionBlock({ section, recipes, onViewRecipe, hideSource, highlightQuery, collapsed, onToggleCollapse }) {
  const headerRef = useRef(null);

  const flash = useCallback(() => {
    if (!headerRef.current) return;
    headerRef.current.classList.remove(styles.flash);
    void headerRef.current.offsetWidth;
    headerRef.current.classList.add(styles.flash);
  }, []);

  useFlashOnHash(section.id, flash);

  const headerClass = [
    styles.sectionHeader,
    section.review ? styles.review : '',
    collapsed ? styles.collapsedHeader : '',
  ].filter(Boolean).join(' ');

  const realCount = recipes.filter((r) => !r.is_blank).length;
  const totalCount = recipes.length;
  const listId = `${section.id}-list`;

  return (
    <div className={styles.sectionBlock} id={section.id}>
      {/* A real heading, so a screen reader can jump section to section, with a
          real button inside it for collapse. It used to be a div with
          role="button", which gave neither. */}
      <h2 ref={headerRef} className={headerClass}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => onToggleCollapse?.(section.key)}
          aria-expanded={!collapsed}
          aria-controls={listId}
          title={collapsed ? 'Click to expand' : 'Click to collapse'}
        >
          <span className={styles.collapseArrow} aria-hidden="true">
            {collapsed ? '▶' : '▼'}
          </span>
          {section.label}
          <span className={styles.countBadge} aria-label={`${realCount} recipe${realCount !== 1 ? 's' : ''}`}>
            {realCount}
            {totalCount > realCount && <span className={styles.countTotal}> /{totalCount}</span>}
          </span>
        </button>
      </h2>
      {!collapsed && (
        <table className={styles.table} id={listId}>
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
                key={recipe.id}
                recipe={recipe}
                onViewRecipe={onViewRecipe}
                hideSource={hideSource}
                highlightQuery={highlightQuery}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default memo(SectionBlock);
