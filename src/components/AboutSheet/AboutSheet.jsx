// About this site: a bottom sheet opened by the (i) in the masthead.
//
// A native <dialog> shown with showModal(), so focus is trapped and the page
// behind is inert without extra code. It is a history layer (ABOUT in
// utils/navHistory.js): Escape, the scrim, Close and Back all go through
// App's onClose, which steps Back, so the sheet and the URL never disagree.
// The copy is Adam's; change the words here, not in a data file.
import { useEffect, useRef } from 'react';
import Icon from '../Icon/Icon.jsx';
import styles from './AboutSheet.module.css';

export default function AboutSheet({ open, onClose }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return undefined;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-labelledby="about-title"
      data-hides-tabbar
      // Escape: let App close it through history rather than the browser.
      onCancel={(e) => { e.preventDefault(); onCloseRef.current(); }}
      // A click on the dialog box itself, outside the content, is the scrim.
      onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
    >
      <div className={styles.content}>
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <h2 id="about-title">About Baker's Recipe List</h2>
          <button type="button" className={styles.close} onClick={() => onCloseRef.current()}>
            <Icon name="close" />Close
          </button>
        </div>
        <p>Every recipe in the Cookbook was cooked and tested by me before I posted it, and I only post the ones I like.</p>
        <p>Some recipe photos are AI-generated. Each one is labeled on its recipe and shows the dish as the recipe describes it.</p>
        <p>Nutrition numbers are estimated from USDA FoodData Central. These are estimates only. For medically relevant dietary planning, consult a registered dietician.</p>
        <p className={styles.install}>On iPhone: tap Share, then Add to Home Screen.</p>
        <p className={styles.maker}>
          <a href="https://buildwithbaker.io" target="_blank" rel="noopener noreferrer">Made by Build with Baker</a>
        </p>
      </div>
    </dialog>
  );
}
