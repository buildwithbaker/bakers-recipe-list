import { useEffect, useRef } from 'react';
import { navSectionsByTab } from '../../data/navSections.js';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import styles from './TOCNav.module.css';

// Hamburger drawer that lists every section that actually renders rows, grouped
// under the tab that owns it. Visibility is controlled by the parent (App) via
// `open` + `onClose`, and navigation is delegated to `onNavigate` because a
// section may live on a tab that is not the active one — App switches the tab,
// then scrolls once the target has rendered.
// Outside-click dismiss: the overlay div covers the full viewport and calls
// onClose directly — clicking anywhere outside the drawer closes it.
export default function TOCNav({ open, onClose, onNavigate, activeTab }) {
  const drawerRef = useRef(null);

  // Trap Tab focus inside the drawer while open (mirrors RecipeModal).
  useFocusTrap(drawerRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleLinkClick = (e, section) => {
    e.preventDefault();
    onNavigate(section);
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <nav
        ref={drawerRef}
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Recipe sections"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>Sections</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close sections menu"
          >
            &#x2715;
          </button>
        </div>
        {navSectionsByTab.map((group) => (
          <div key={group.tab} className={styles.group}>
            <div className={styles.groupHeading}>
              {group.label}
              {group.tab === activeTab && (
                <span className={styles.groupCurrent}>current tab</span>
              )}
            </div>
            <ul className={styles.list}>
              {group.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={section.review ? `${styles.link} ${styles.review}` : styles.link}
                    onClick={(e) => handleLinkClick(e, section)}
                  >
                    {section.label}
                    <span className={styles.count}>{section.count}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
