// The navy band across the top of every screen: wordmark, a one-line summary of
// the collection, and the shopping list.
//
// The wordmark is the page's h1 on the list. On a full recipe page the recipe
// is the h1, so the wordmark steps down to plain text and becomes the way home.
import { CATALOG_COUNTS } from '../../data/catalog.js';
import { BASE_PATH } from '../../utils/recipeRoute.js';
import { isModifiedClick } from '../../utils/isModifiedClick.js';
import Icon from '../Icon/Icon.jsx';
import styles from './Masthead.module.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const TAGLINE = `${plural(CATALOG_COUNTS.written, 'recipe')} · ${CATALOG_COUNTS.toTry} to try`;

export default function Masthead({ listItemCount, onListToggle, siteTitleIsHeading = true, slim = false, onHome }) {
  const Title = siteTitleIsHeading ? 'h1' : 'p';
  const word = <>Baker’s <span className={styles.accent}>Recipe</span> List</>;
  return (
    <header className={`${styles.masthead} ${slim ? styles.slim : ''}`}>
      <div className={`wrap ${styles.inner}`}>
        <div className={styles.brand}>
          <Title className={styles.wordmark}>
            {onHome ? (
              <a
                className={styles.home}
                href={BASE_PATH}
                onClick={(e) => {
                  if (isModifiedClick(e)) return;
                  e.preventDefault();
                  onHome();
                }}
              >
                {word}
              </a>
            ) : word}
          </Title>
          {!slim && <p className={styles.tagline}>{TAGLINE}</p>}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.pill}
            onClick={onListToggle}
            aria-label={`Shopping list, ${plural(listItemCount, 'item')}`}
          >
            <Icon name="list" />
            <span className={styles.lbl}>Shopping list</span>
            {listItemCount > 0 && <span className={styles.badge} aria-hidden="true">{listItemCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}
