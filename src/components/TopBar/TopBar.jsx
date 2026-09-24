import styles from './TopBar.module.css';

// The site name is the page's h1 on the list. On a full recipe page the recipe
// is the h1, so the site name steps down to plain text rather than making a
// second top-level heading.
export default function TopBar({ onMenuToggle, onListToggle, listItemCount, darkMode, onToggleDark, siteTitleIsHeading = true }) {
  const SiteTitle = siteTitleIsHeading ? 'h1' : 'p';
  return (
    <header className={styles.topBar}>
      <SiteTitle className={styles.title}>
        Baker's Recipe List
        <small className={styles.subtitle}>· Adam's Kitchen</small>
      </SiteTitle>
      <div className={styles.actions}>
        {/* Dark mode toggle */}
        <button
          type="button"
          className={styles.iconAction}
          onClick={onToggleDark}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? (
            /* Sun icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            /* Moon icon */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Shopping list */}
        <button
          type="button"
          className={styles.listButton}
          onClick={onListToggle}
          aria-label="Shopping list"
          title="Shopping list"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          {listItemCount > 0 && (
            <span className={styles.badge} aria-label={`${listItemCount} items`}>{listItemCount}</span>
          )}
        </button>

        {/* Sections menu */}
        <button
          type="button"
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Open sections menu"
        >
          <span className={styles.bar} />
          <span className={styles.bar} />
          <span className={styles.bar} />
        </button>
      </div>
    </header>
  );
}
