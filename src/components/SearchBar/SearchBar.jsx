import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import Icon from '../Icon/Icon.jsx';
import styles from './SearchBar.module.css';

// The one search box. It searches every collection (see utils/search.js), sits
// across the bottom edge of the masthead, and uses 17px text so iOS Safari does
// not zoom the page when it takes focus. The native clear button is hidden in
// favour of ours, which is a real 44px target in every browser.
const SearchBar = forwardRef(function SearchBar({ value, onChange }, ref) {
  const inputRef = useRef(null);
  const inputId = useId();

  useImperativeHandle(ref, () => ({
    focus() { inputRef.current?.focus(); },
  }), []);

  return (
    <div className={`wrap ${styles.finder}`}>
      <div className={styles.search} role="search">
        <label htmlFor={inputId} className="sr-only">Search recipes and ingredients</label>
        <Icon name="search" className={styles.icon} />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder="Find a recipe or ingredient"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck="false"
          enterKeyHint="search"
        />
        {value && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => { onChange(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            <Icon name="close" />
          </button>
        )}
      </div>
    </div>
  );
});

export default SearchBar;
