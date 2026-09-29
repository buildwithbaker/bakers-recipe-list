// The badge on an AI-generated recipe photo (see src/data/photoCredits.json).
//
// Faint on purpose (--ai-badge-opacity): the caption under the photo carries
// the AI label in tested colours, so the badge only marks the image itself.
// Reads "AI-generated image" to a screen reader. Sits over the bottom-right
// corner of its positioned parent. Recipe header only; cards carry no badge.
import styles from './AiBadge.module.css';

export default function AiBadge() {
  return (
    <span className={styles.badge} role="img" aria-label="AI-generated image">
      AI
    </span>
  );
}
