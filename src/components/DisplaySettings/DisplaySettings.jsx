// The "Display" control in a recipe's Method header: why notes and the
// amounts written inside steps, each a switch that applies as it is tapped.
//
// Below 720px it opens a bottom sheet built the way FiltersSheet is: a modal
// dialog with a scrim and a handle, focus moved in and trapped, Escape, the
// scrim or Done closes it, and focus goes back to the button. Wider, it is a
// small dropdown under the button with no scrim: Escape or a click outside
// closes it, and focus moves in on open and back to the button on close.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import Icon from '../Icon/Icon.jsx';
import styles from './DisplaySettings.module.css';

const WIDE_QUERY = '(min-width: 720px)';
const isWide = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_QUERY).matches;

// Escape closes this panel and nothing else. Caught on the way down, before
// RecipeModal's own document listener would close the whole recipe.
function useEscape(onEscape) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onEscape.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onEscape]);
}

function SwitchRow({ label, hint, checked, onChange, rowRef }) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      ref={rowRef}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hintId}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.rowText}>
        <span id={labelId} className={styles.rowLabel}>{label}</span>
        <span id={hintId} className={styles.rowHint}>{hint}</span>
      </span>
      <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
    </button>
  );
}

function Rows({ showWhyRow, settings, onChange, firstRef }) {
  return (
    <div className={styles.rows}>
      {showWhyRow && (
        <SwitchRow
          rowRef={firstRef}
          label="Why notes"
          hint="Short reasons after key steps"
          checked={settings.why}
          onChange={(on) => onChange('why', on)}
        />
      )}
      <SwitchRow
        rowRef={showWhyRow ? undefined : firstRef}
        label="Amounts in steps"
        hint="Quantities inside each step, like (1 tsp)"
        checked={settings.amounts}
        onChange={(on) => onChange('amounts', on)}
      />
    </div>
  );
}

function Sheet({ titleId, onClose, children, firstRef }) {
  const sheetRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useFocusTrap(sheetRef, true);
  useEscape(onCloseRef);

  useEffect(() => {
    firstRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [firstRef]);

  // On <body>, not inside the recipe: in the card view the recipe sits in
  // RecipeModal's own dialog, whose focus trap would otherwise share the keys.
  return createPortal(
    <>
      <div className={styles.scrim} onClick={() => onClose()} aria-hidden="true" />
      <div ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId} data-hides-tabbar>
        <div className={styles.handle} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>Display</h2>
        {children}
        <button type="button" className={styles.done} onClick={() => onClose()}>Done</button>
      </div>
    </>,
    document.body,
  );
}

function Dropdown({ titleId, onClose, children, firstRef, anchorRef }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEscape(onCloseRef);

  useEffect(() => {
    firstRef.current?.focus();
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onCloseRef.current({ outside: true });
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [firstRef, anchorRef]);

  return (
    <div ref={panelRef} className={styles.dropdown} role="dialog" aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>Display</h2>
      {children}
    </div>
  );
}

/**
 * @param settings    { why, amounts } — both booleans
 * @param onChange    (name, on) -> void; applied live
 * @param showWhyRow  false hides the "Why notes" row (the recipe has no why)
 */
export default function DisplaySettings({ settings, onChange, showWhyRow }) {
  const [mode, setMode] = useState(null); // null | 'sheet' | 'dropdown'
  const buttonRef = useRef(null);
  const firstRef = useRef(null);
  const titleId = useId();

  const open = () => setMode(isWide() ? 'dropdown' : 'sheet');
  // Every close hands focus back to the button, except a click outside that
  // landed on another control: that control keeps the focus it took.
  const close = ({ outside = false } = {}) => {
    setMode(null);
    if (!outside) { buttonRef.current?.focus(); return; }
    setTimeout(() => {
      const el = document.activeElement;
      if (!el || el === document.body) buttonRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  const rows = <Rows showWhyRow={showWhyRow} settings={settings} onChange={onChange} firstRef={firstRef} />;

  return (
    <div className={styles.wrap} data-print-hide>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={mode !== null}
        onClick={() => (mode ? close() : open())}
      >
        <Icon name="sliders" />Display
      </button>
      {mode === 'sheet' && <Sheet titleId={titleId} onClose={close} firstRef={firstRef}>{rows}</Sheet>}
      {mode === 'dropdown' && (
        <Dropdown titleId={titleId} onClose={close} firstRef={firstRef} anchorRef={buttonRef}>{rows}</Dropdown>
      )}
    </div>
  );
}
