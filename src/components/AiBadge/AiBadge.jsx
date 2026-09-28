// The label every AI-generated photo carries (see src/data/photoCredits.json).
//
// Reads "AI" on screen and "AI-generated image" to a screen reader, so the
// label is there even where the photo itself is decorative (alt="" on cards).
// Sits over a corner of its positioned parent; `size` picks the card or the
// recipe-header scale.
import styles from './AiBadge.module.css';

export default function AiBadge({ size = 'sm' }) {
  return (
    <span className={`${styles.badge} ${styles[size]}`} role="img" aria-label="AI-generated image">
      AI
    </span>
  );
}
