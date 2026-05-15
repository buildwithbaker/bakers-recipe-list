// Tracks which recipes the user has cooked, persisted to localStorage.
// Returns [madeSet, toggleMade] where:
//   madeSet       — Set of recipe name strings
//   toggleMade(name) — adds if absent, removes if present

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'brl_made_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function save(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])); }
  catch { /* quota exceeded */ }
}

export function useCookHistory() {
  const [madeSet, setMadeSet] = useState(load);

  const toggleMade = useCallback((recipeName) => {
    setMadeSet((prev) => {
      const next = new Set(prev);
      if (next.has(recipeName)) next.delete(recipeName);
      else next.add(recipeName);
      save(next);
      return next;
    });
  }, []);

  return [madeSet, toggleMade];
}
