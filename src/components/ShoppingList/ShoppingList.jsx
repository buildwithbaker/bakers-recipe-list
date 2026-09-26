// The shopping list: a sheet over whatever is on screen (the list, or a recipe
// card, since "Add to shopping list" opens it on top of the card).
//
// A modal dialog: focus moves in and is trapped, Escape or the scrim closes
// it, and focus returns to what opened it. Print uses print-only CSS
// (globals.css [data-print-list]) rather than a popup window, which popup
// blockers break.
import { useEffect, useRef } from 'react';
import { resolveRecipe } from '../../data/recipeIndex.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import Icon from '../Icon/Icon.jsx';
import styles from './ShoppingList.module.css';

// Items are keyed by recipe id; the heading needs a name. Falls back to the
// stored key so a group whose recipe has since been removed still labels
// itself with whatever it was added under.
function recipeLabel(key) {
  return resolveRecipe(key)?.name ?? key;
}

// Groups a flat items array by recipe id, preserving insertion order.
function groupByRecipe(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.recipe)) map.set(item.recipe, []);
    map.get(item.recipe).push(item);
  }
  return map;
}

export default function ShoppingList({ items, open, onClose, onToggle, onRemove, onClearChecked, onClearAll }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useFocusTrap(panelRef, open);

  const checkedCount = items.filter((it) => it.checked).length;
  const totalCount = items.length;
  const groups = groupByRecipe(items);

  // Focus in on open, back to the opener on close; Escape closes; the page
  // behind does not scroll while the list is up.
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-list-title"
        data-print-list
      >
        <div className={styles.header}>
          <h2 id="shopping-list-title" className={styles.title}>Shopping list</h2>
          {totalCount > 0 && <span className={styles.count}>{totalCount - checkedCount} left</span>}
          <div className={styles.headerActions} data-print-hide>
            {totalCount > 0 && (
              <button type="button" className={styles.iconBtn} onClick={() => window.print()} aria-label="Print list">
                <Icon name="print" />
              </button>
            )}
            <button ref={closeRef} type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close shopping list">
              <Icon name="close" />
            </button>
          </div>
        </div>

        {totalCount === 0 && (
          <div className={styles.emptyState}>
            <Icon name="list" className={styles.emptyIcon} />
            <p>Your list is empty.</p>
            <p className={styles.emptyHint}>Open a recipe and choose <strong>Add to shopping list</strong>.</p>
          </div>
        )}

        {totalCount > 0 && (
          <div className={styles.body}>
            {[...groups.entries()].map(([recipe, rItems]) => (
              <section key={recipe} className={styles.group}>
                <h3 className={styles.groupLabel}>{recipeLabel(recipe)}</h3>
                <ul className={styles.itemList}>
                  {rItems.map((item) => (
                    <li key={item.id} className={`${styles.item} ${item.checked ? styles.itemChecked : ''}`}>
                      {/* The whole row toggles; the box is its visible state. */}
                      <button
                        type="button"
                        className={styles.check}
                        onClick={() => onToggle(item.id)}
                        aria-pressed={item.checked}
                      >
                        <span className={styles.box} aria-hidden="true">{item.checked && <Icon name="check" />}</span>
                        <span className={styles.itemText}>{item.text}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => onRemove(item.id)}
                        aria-label={`Remove ${item.text}`}
                        data-print-hide
                      >
                        <Icon name="close" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {totalCount > 0 && (
          <div className={styles.footer} data-print-hide>
            {checkedCount > 0 && (
              <button type="button" className={styles.footerBtn} onClick={onClearChecked}>
                Remove checked ({checkedCount})
              </button>
            )}
            <button type="button" className={`${styles.footerBtn} ${styles.danger}`} onClick={onClearAll}>
              Clear all
            </button>
          </div>
        )}
      </div>
    </>
  );
}
