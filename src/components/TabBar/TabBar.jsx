// The three main destinations: Recipes, Pinned, Shopping.
//
// Rendered twice by App: `placement="bottom"` is the fixed bar on a phone,
// `placement="header"` sits in the masthead from 720px up. CSS shows exactly
// one at a time, so only one <nav aria-label="Main"> is ever in the
// accessibility tree. (One element cannot serve both: the sticky masthead is
// its own stacking context, so a bar inside it could not sit above the
// shopping list's scrim.)
//
// Taps go to App, which owns history (utils/navHistory.js): every switch is
// a Back stop, and a tap on the current tab scrolls it to the top.
import { TAB_PINNED, TAB_RECIPES, TAB_SHOPPING } from '../../utils/navHistory.js';
import Icon from '../Icon/Icon.jsx';
import styles from './TabBar.module.css';

const TABS = [
  [TAB_RECIPES, 'Recipes', 'book'],
  [TAB_PINNED, 'Pinned', 'star'],
  [TAB_SHOPPING, 'Shopping', 'basket'],
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function TabBar({ placement, active, onTab, listCount }) {
  return (
    <nav aria-label="Main" className={`${styles.bar} ${styles[placement]}`}>
      {TABS.map(([key, label, icon]) => (
        <button
          key={key}
          type="button"
          className={styles.tab}
          aria-current={active === key ? 'page' : undefined}
          onClick={() => onTab(key)}
        >
          <span className={styles.icon}>
            <Icon name={icon} filled={key === TAB_PINNED && active === key} />
            {key === TAB_SHOPPING && listCount > 0 && (
              <span className={styles.badge} aria-hidden="true">{listCount}</span>
            )}
          </span>
          <span className={styles.label}>{label}</span>
          {key === TAB_SHOPPING && listCount > 0 && <span className="sr-only">, {plural(listCount, 'item')}</span>}
        </button>
      ))}
    </nav>
  );
}
