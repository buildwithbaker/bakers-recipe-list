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

  return (
    <div className={styles.sectionBlock} id={section.id}>
      <div
        ref={headerRef}
        className={headerClass}
        onClick={() => onToggleCollapse?.(section.key)}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse?.(section.key); } }}
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
      </div>
      {!collapsed && (
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
