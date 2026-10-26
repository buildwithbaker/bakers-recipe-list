import { useState } from 'react';
import { USDA_API_KEY } from '../../utils/fetchNutrition.js';
import styles from './UsdaKeyNotice.module.css';

const STORAGE_KEY = 'usda_notice_dismissed_v1';

// A developer hint, never shown to readers: it renders only in the Vite dev
// server (import.meta.env.DEV), and there only while the app is still using
// the public DEMO_KEY (rate-limited to ~30 requests/hour). Every built site -
// production, preview, or a local build with no key - leaves it out. Also
// dismissible per-browser.
export default function UsdaKeyNotice() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!import.meta.env.DEV) return null;
  if (USDA_API_KEY !== 'DEMO_KEY') return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore quota issues */
    }
    setDismissed(true);
  };

  return (
    <div className={styles.notice}>
      <span className={styles.text}>
        <strong>Heads up:</strong> nutrition estimates use the public USDA{' '}
        <code>DEMO_KEY</code>, which rate-limits after ~30 lookups. Get a free
        key (instant) at{' '}
        <a
          href="https://fdc.nal.usda.gov/api-key-signup.html"
          target="_blank"
          rel="noreferrer noopener"
          className={styles.link}
        >
          fdc.nal.usda.gov
        </a>
        {' '}and set it as <code>VITE_USDA_API_KEY</code> in{' '}
        <code>.env.local</code> (or the deploy secret for production).
      </span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDismiss}
        aria-label="Dismiss notice"
      >
        &#x2715;
      </button>
    </div>
  );
}
