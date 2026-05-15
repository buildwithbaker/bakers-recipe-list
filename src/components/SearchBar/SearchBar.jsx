import { forwardRef, useImperativeHandle, useRef } from 'react';
import styles from './SearchBar.module.css';

// forwardRef + useImperativeHandle exposes a focus() method to the parent
// (App.jsx) so the "/" keyboard shortcut can programmatically focus the input
// without making the input uncontrolled or lifting state.
const SearchBar = forwardRef(function SearchBar({ value, onChange }, ref) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus() { inputRef.current?.focus(); },
  }), []);

  return (
    <div className={styles.bar}>
      <svg className={styles.icon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder="Search recipes, tags… (press / to focus)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search recipes"
        autoComplete="off"
        spellCheck="false"
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          aria-label="Clear search"
        >
          &#x2715;
        </button>
      )}
    </div>
  );
});

export default SearchBar;
