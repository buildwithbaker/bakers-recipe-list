// Filters for the Cookbook and For Review: pinned only, made, and tags.
//
// A bottom sheet on a phone, a side sheet on a wider screen. It is a modal
// dialog: focus moves in on open and is trapped, Escape or the scrim closes
// it, and focus returns to the button that opened it. Filters apply as you
// tap, so "Show N recipes" always states the list you will land on.
import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import Icon from '../Icon/Icon.jsx';
import styles from './FiltersSheet.module.css';

const MADE_OPTIONS = [['all', 'Any'], ['made', 'Made it'], ['unmade', 'Not made yet']];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function FiltersSheet({
  onClose, returnFocusRef, resultCount,
  pinnedOnly, onTogglePinned, made, onMadeChange,
  tags, selectedTags, onToggleTag, onClearAll,
}) {
  const sheetRef = useRef(null);
  const firstRef = useRef(null);
  // The latest onClose, read by the key handler, so the open/close effect
  // below runs once per opening and not on every re-render (re-running it
  // would bounce focus back to the first control after each tap).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useFocusTrap(sheetRef, true);

  useEffect(() => {
    firstRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const returnTo = returnFocusRef?.current;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      returnTo?.focus();
    };
  }, [returnFocusRef]);

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="filters-title">
        <div className={styles.head}>
          <h2 id="filters-title">Filters</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close filters">
            <Icon name="close" />
          </button>
        </div>

        <h3 id="f-show">Show</h3>
        <div className={styles.wraps} role="group" aria-labelledby="f-show">
          <button
            ref={firstRef}
            type="button"
            className={`${styles.btn} ${styles.pin}`}
            aria-pressed={pinnedOnly}
            onClick={onTogglePinned}
          >
            <Icon name="star" filled={pinnedOnly} />Pinned only
          </button>
        </div>

        <h3 id="f-made">Made</h3>
        <div className={styles.wraps} role="group" aria-labelledby="f-made">
          {MADE_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={styles.btn}
              aria-pressed={made === value}
              onClick={() => onMadeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {tags.length > 0 && (
          <>
            <h3 id="f-tags">Tags</h3>
            <div className={styles.wraps} role="group" aria-labelledby="f-tags">
              {tags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  className={styles.chip}
                  aria-pressed={selectedTags.has(tag)}
                  onClick={() => onToggleTag(tag)}
                >
                  {tag.replace(/^#/, '')}<span className={styles.n}>{count}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className={`${styles.wraps} ${styles.foot}`}>
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={onClose}>
            Show {plural(resultCount, 'recipe')}
          </button>
          <button type="button" className={styles.btn} onClick={onClearAll}>Clear all</button>
        </div>
      </div>
    </>
  );
}
