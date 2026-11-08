// A technique as a popup card: a bottom sheet on a phone, a centred dialog on a
// wide screen (the Filters sheet's pattern: scrim, focus trap, Escape, focus
// back to the opener). Contents in order: kicker, title, diagram, How, Why, and
// a link to the technique on the Learning to Cook page.
//
// History is owned by useTechniquePopup (Back closes this and nothing else).
// Escape is caught in the capture phase and stopped here, so when the popup is
// open over the recipe modal the Escape closes only the popup.
import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { BASE_PATH, learningPath } from '../../utils/recipeRoute.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import Icon from '../Icon/Icon.jsx';
import styles from './TechniqueSheet.module.css';

export const ALL_TECHNIQUES_TEXT = 'All techniques in Learning to Cook';

export default function TechniqueSheet({ technique, onClose, onLearn, returnFocusRef }) {
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useFocusTrap(sheetRef, true);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const returnTo = returnFocusRef?.current;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  const titleId = `technique-${technique.id}-title`;
  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-hides-tabbar
        data-print-hide
      >
        <div className={styles.head}>
          <span className={styles.kicker}>{technique.kicker}</span>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <h2 id={titleId} className={styles.title}>{technique.title}</h2>
        <img
          className={styles.diagram}
          src={`${BASE_PATH}${technique.diagram.src.replace(/^\/+/, '')}`}
          alt={technique.diagram.alt}
        />
        <ol className={styles.how} aria-label="How">
          {technique.how.map((line) => <li key={line}>{line}</li>)}
        </ol>
        <p className={styles.why}>{technique.why}</p>
        <a
          className={styles.all}
          href={learningPath(undefined, technique.id)}
          onClick={(e) => {
            if (isModifiedClick(e) || !onLearn) return;
            e.preventDefault();
            onLearn(technique.id);
          }}
        >
          {ALL_TECHNIQUES_TEXT}
          <Icon name="back" />
        </a>
      </div>
    </>
  );
}
