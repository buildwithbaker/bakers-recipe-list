// The recipe card over the list: a backdrop, a focus-trapped dialog, and the
// two controls that only make sense as a modal: Close and "Open full page".
//
// The recipe itself is RecipeView, which the /r/<slug>/ page renders too. Both
// are the SAME route (App.jsx reads it off location.pathname), so the modal is
// a presentation choice, not a different destination: whichever one you are
// looking at, Share hands out the same URL.
import { useEffect, useId, useRef } from 'react';
import styles from './RecipeModal.module.css';
import RecipeView from '../RecipeView/RecipeView.jsx';
import Icon from '../Icon/Icon.jsx';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

export default function RecipeModal({ recipe, onClose, onOpenFullPage, onTagClick, onAddToList }) {
  const titleId = useId();
  const modalCardRef = useRef(null);
  const closeRef = useRef(null);

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

  // Move focus into the dialog, and put it back where it was (usually the card
  // that opened it) when the dialog closes, so a keyboard user keeps their
  // place in the list. Done here rather than with autoFocus: autoFocus moves
  // focus before this effect runs, and the opener would be lost.
  useEffect(() => {
    if (!recipe) return undefined;
    const opener = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
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
          headingLevel={2}
          barEnd={
            <>
              {onOpenFullPage && (
                <button type="button" className={styles.barBtn} onClick={onOpenFullPage} aria-label="Open full page">
                  <Icon name="ext" />
                </button>
              )}
              <button ref={closeRef} type="button" className={styles.barBtn} onClick={onClose} aria-label="Close">
                <Icon name="close" />
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}
