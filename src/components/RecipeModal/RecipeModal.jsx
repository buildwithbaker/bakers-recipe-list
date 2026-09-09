// The recipe card over the list: a backdrop, a focus-trapped dialog, and the
// three buttons that only make sense as a modal — close, and "open full page".
//
// The recipe itself is RecipeView, which the /r/<slug>/ page renders too. Both
// are the SAME route (App.jsx reads it off location.pathname), so the modal is
// a presentation choice, not a different destination: whichever one you are
// looking at, Share hands out the same URL.
import { useEffect, useId, useRef } from 'react';
import styles from './RecipeModal.module.css';
import RecipeView from '../RecipeView/RecipeView.jsx';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export default function RecipeModal({ recipe, onClose, onOpenFullPage, onTagClick, onAddToList }) {
  const titleId = useId();
  const modalCardRef = useRef(null);

  useFocusTrap(modalCardRef, !!recipe);

  useEffect(() => {
    if (!recipe) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [recipe, onClose]);

  useEffect(() => {
    if (!recipe) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [recipe]);

  if (!recipe) return null;

  const handleOverlayClick = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div ref={modalCardRef} className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby={titleId} data-print-modal>
        <RecipeView
          recipe={recipe}
          titleId={titleId}
          onTagClick={onTagClick}
          onAddToList={onAddToList}
          extraActions={
            <>
              {onOpenFullPage && (
                <button
                  type="button"
                  className={styles.fullPageBtn}
                  onClick={onOpenFullPage}
                  aria-label="Open full page"
                  title="Open full page"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h6v6"/><path d="M10 14 21 3"/>
                    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>
                  </svg>
                </button>
              )}
              <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close" autoFocus>&#x2715;</button>
            </>
          }
        />
      </div>
    </div>
  );
}
