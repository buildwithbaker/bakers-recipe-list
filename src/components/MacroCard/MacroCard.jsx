import styles from './MacroCard.module.css';

export default function MacroCard({ status, macros, matchedCount, totalCount }) {
  if (status === 'unavailable' || status === 'error') return null;

  if (status === 'rate-limited') {
    return (
      <div className={styles.card}>
        <div className={styles.title}>Estimated Nutrition</div>
        <div className={styles.partial}>
          USDA API rate limit reached for this session. Register a free key at{' '}
          <a
            href="https://fdc.nal.usda.gov/api-key-signup.html"
            target="_blank"
            rel="noreferrer noopener"
          >
            fdc.nal.usda.gov
          </a>{' '}
          and set it as <code>VITE_USDA_API_KEY</code> (in <code>.env.local</code>{' '}
          for local dev, or the deploy secret for production).
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className={styles.card}>
        <div className={styles.loading}>
          Estimating nutrition<span className={styles.dots}>...</span>
        </div>
      </div>
    );
  }

  if (status === 'done' && macros) {
    const stats = [
      { value: `${macros.calories}`, label: 'cal' },
      { value: `${macros.protein}g`, label: 'protein' },
      { value: `${macros.fat}g`, label: 'fat' },
      { value: `${macros.carbs}g`, label: 'carbs' },
      { value: `${macros.fiber}g`, label: 'fiber' },
    ];
    const matchPct = totalCount ? matchedCount / totalCount : 1;
    const showPartialNote = matchPct < 0.7;
    return (
      <div className={styles.card}>
        <div className={styles.title}>Estimated Nutrition (per serving)</div>
        <div className={styles.row}>
          {stats.map((s, i) => (
            <span key={i} className={styles.stat}>
              <span className={styles.value}>{s.value}</span>
              <span className={styles.label}>{s.label}</span>
            </span>
          ))}
        </div>
        <div className={styles.footnote}>
          Estimates only · {matchedCount} of {totalCount} ingredients matched · Not dietician-verified
        </div>
        {showPartialNote && (
          <div className={styles.partial}>
            Some ingredients could not be estimated and were excluded.
          </div>
        )}
      </div>
    );
  }

  return null;
}
