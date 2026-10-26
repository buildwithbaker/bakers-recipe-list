import { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import { SEARCH_MODES } from '../../utils/search.js';
import Icon from '../Icon/Icon.jsx';
import styles from './SearchBar.module.css';

const MODE_OPTIONS = [
  [SEARCH_MODES.NAME, 'Name'],
  [SEARCH_MODES.INGREDIENT, 'Ingredient'],
  [SEARCH_MODES.ALL, 'All'],
];

// The one search box. It searches the Cookbook (see utils/search.js), sits
// across the bottom edge of the masthead, and uses 17px text so iOS Safari does
// not zoom the page when it takes focus. The native clear button is hidden in
// favour of ours, which is a real 44px target in every browser.
//
// Under the box, the Name / Ingredient / All toggle picks what the query is
// matched against (App owns the mode; utils/search.js has the rules). It is
// shown only when a mode handler is passed.
const SearchBar = forwardRef(function SearchBar({ value, onChange, mode = SEARCH_MODES.ALL, onModeChange }, ref) {
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
      {onModeChange && (
        <div className={styles.modes} role="group" aria-label="Search in">
          {MODE_OPTIONS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={styles.mode}
              aria-pressed={mode === key}
              onClick={() => onModeChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default SearchBar;
