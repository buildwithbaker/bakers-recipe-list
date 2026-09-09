// Recipes that share tags with this one. FULL PAGE ONLY — in a modal the whole
// list is already sitting right behind the card.
//
// Every entry is a REAL <a href="/bakers-recipe-list/r/<slug>/">. That is the
// point, not a detail: it is what turns the prerendered pages from orphans into
// a graph a crawler can walk, it makes middle-click and open-in-new-tab behave
// the way a link should, and it still works with JavaScript off. The click
// handler is an enhancement layered on top — it intercepts only a plain left
// click and leaves every modified click to the browser.
import { useId, useMemo } from 'react';
import styles from './RelatedRecipes.module.css';
import { displayRecipes } from '../../data/recipeIndex.js';
import { relatedRecipes } from '../../utils/relatedRecipes.js';
import { recipePath } from '../../utils/recipeRoute.js';

// A click the browser should handle itself: new tab, new window, download,
// or anything but the primary button.
const isModifiedClick = (e) =>
  e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export default function RelatedRecipes({ recipe, onNavigate }) {
  const headingId = useId();
  const items = useMemo(() => relatedRecipes(recipe, displayRecipes), [recipe]);

  // No shared tags, no section. Padding this out with arbitrary recipes would
  // teach the visitor that the heading means nothing.
  if (items.length === 0) return null;

  return (
    <nav className={styles.related} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>Related recipes</h2>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <a
              className={styles.link}
              href={recipePath(item.id)}
              onClick={(e) => {
                if (isModifiedClick(e)) return;
                e.preventDefault();
                onNavigate?.(item);
              }}
            >
              <span className={styles.name}>{item.name}</span>
              <span className={styles.category}>{item.category}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
