import styles from './MacroCard.module.css';

// `status` is computeMacros' result status (see hooks/useMacroEstimate.js).
// `unit` is what one portion is called: "serving" unless the recipe's authored
// yield names something else ("patty", "ball", ...).
export default function MacroCard({ status, perServing, excluded = [], missing = [], reason, unit = 'serving' }) {
  if (status === 'skipped') {
    return (
      <div className={styles.card}>
        <div className={styles.title}>Nutrition not estimated</div>
        <div className={styles.footnote}>{reason}</div>
      </div>
    );
  }

  if (status === 'incomplete') {
    const n = missing.length;
    return (
      <div className={styles.card}>
        <div className={styles.partial}>
          Nutrition unavailable: {n} ingredient {n === 1 ? 'line is' : 'lines are'} not mapped
        </div>
      </div>
    );
  }

  if (status === 'ok' && perServing) {
    const stats = [
      { value: `${perServing.calories}`, label: 'cal' },
      { value: `${perServing.protein}g`, label: 'protein' },
      { value: `${perServing.fat}g`, label: 'fat' },
      { value: `${perServing.carbs}g`, label: 'carbs' },
      { value: `${perServing.fiber}g`, label: 'fiber' },
    ];
    return (
      <div className={styles.card}>
        <div className={styles.title}>Estimated Nutrition (per {unit})</div>
        <div className={styles.row}>
          {stats.map((s) => (
            <span key={s.label} className={styles.stat}>
              <span className={styles.value}>{s.value}</span>
              <span className={styles.label}>{s.label}</span>
            </span>
          ))}
        </div>
        <div className={styles.footnote}>
          Estimated from USDA FoodData Central · Not dietitian-verified
        </div>
        {excluded.length > 0 && (
          <details className={styles.excluded}>
            <summary>Not counted ({excluded.length})</summary>
            <ul>
              {excluded.map((e) => (
                <li key={e.text}>
                  {e.text} <span className={styles.reason}>({e.reason})</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }

  return null;
}
