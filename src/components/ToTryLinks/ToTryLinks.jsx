// To Try entries: links to recipes on other sites, saved to cook later. Each
// opens in a new tab. The row shows the site's domain so you know where you
// are going before you tap.
import Icon from '../Icon/Icon.jsx';
import Highlight from '../Highlight/Highlight.jsx';
import styles from './ToTryLinks.module.css';

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export default function ToTryLinks({ rows, columns = false, highlight = '' }) {
  return (
    <ul className={`${styles.links} ${columns ? styles.cols : ''}`}>
      {rows.map((r) => (
        <li key={r.id}>
          <a href={r.source} target="_blank" rel="noopener noreferrer">
            <span className={styles.name}><Highlight text={r.name} query={highlight} /></span>
            <span className={styles.domain}>{domainOf(r.source)}</span>
            <Icon name="ext" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
