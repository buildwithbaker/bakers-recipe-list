import { useEffect, useState } from 'react';
import styles from './BackToTop.module.css';

// Appears once the user scrolls more than 300px down the page.
// Uses a passive scroll listener — more reliable than IntersectionObserver
// on a sentinel element, which can break when ancestors have overflow:hidden.
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Check immediately in case the page loads scrolled (e.g. restored state).
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
    >
      ↑
    </button>
  );
}
