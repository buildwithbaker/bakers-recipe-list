import { useEffect, useRef } from 'react';
import styles from './ShoppingList.module.css';

// Groups a flat items array by recipe name, preserving insertion order.
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
  const checkedCount = items.filter((it) => it.checked).length;
  const totalCount = items.length;
  const groups = groupByRecipe(items);

  // Trap focus inside the panel when open; close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll when panel is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  // Print via print-only CSS (see globals.css [data-print-list]) rather than
  // opening a popup window — popups are blocker-fragile. The @media print rules
  // hide everything except the list and strip the interactive chrome.
  const handlePrint = () => window.print();

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={styles.panel}
        role="complementary"
        aria-label="Shopping list"
        data-print-list
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            Shopping List
            {totalCount > 0 && (
              <span className={styles.countChip}>{totalCount - checkedCount} left</span>
            )}
          </h2>
          <div className={styles.headerActions} data-print-hide>
            {totalCount > 0 && (
              <button type="button" className={styles.iconBtn} onClick={handlePrint} title="Print list" aria-label="Print list">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                </svg>
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close shopping list">&#x2715;</button>
          </div>
        </div>

        {/* Empty state */}
        {totalCount === 0 && (
          <div className={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.emptyIcon}>
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <p>Your list is empty.</p>
            <p className={styles.emptyHint}>Open a recipe and tap <strong>List</strong> to add ingredients.</p>
          </div>
        )}

        {/* Item groups */}
        {totalCount > 0 && (
          <div className={styles.body}>
            {[...groups.entries()].map(([recipe, rItems]) => (
              <div key={recipe} className={styles.group}>
                <div className={styles.groupLabel}>{recipe}</div>
                <ul className={styles.itemList}>
                  {rItems.map((item) => (
                    <li key={item.id} className={`${styles.item} ${item.checked ? styles.itemChecked : ''}`}>
                      <button
                        type="button"
                        className={styles.checkbox}
                        onClick={() => onToggle(item.id)}
                        aria-label={item.checked ? 'Uncheck' : 'Check off'}
                        aria-pressed={item.checked}
                      >
                        {item.checked ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : null}
                      </button>
                      <span className={styles.itemText}>{item.text}</span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => onRemove(item.id)}
                        aria-label="Remove item"
                        data-print-hide
                      >×</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        {totalCount > 0 && (
          <div className={styles.footer} data-print-hide>
            {checkedCount > 0 && (
              <button type="button" className={styles.footerBtn} onClick={onClearChecked}>
                Remove checked ({checkedCount})
              </button>
            )}
            <button type="button" className={`${styles.footerBtn} ${styles.footerBtnDanger}`} onClick={onClearAll}>
              Clear all
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
