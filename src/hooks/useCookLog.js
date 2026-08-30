// Per-recipe cook log: tracks every date the user marked a recipe as made,
// plus freetext notes. Stored separately from the made-Set so toggling
// "unmade" doesn't erase the history.
//
// localStorage key: 'brl_cook_log'
// schema: { [recipeId]: { dates: string[], notes: string } }

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'brl_cook_log';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(log) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(log)); }
  catch { /* quota — ignore */ }
}

export function useCookLog() {
  const [cookLog, setCookLog] = useState(load);

  // Called when the user marks a recipe as made (not when unmarking).
  const logCook = useCallback((name) => {
    setCookLog((prev) => {
      const entry = prev[name] ?? { dates: [], notes: '' };
      const next = {
        ...prev,
        [name]: { ...entry, dates: [...entry.dates, new Date().toISOString()] },
      };
      save(next);
      return next;
    });
  }, []);

  // Called from the notes textarea in RecipeModal.
  const updateNotes = useCallback((name, text) => {
    setCookLog((prev) => {
      const entry = prev[name] ?? { dates: [], notes: '' };
      const next = { ...prev, [name]: { ...entry, notes: text } };
      save(next);
      return next;
    });
  }, []);

  return [cookLog, logCook, updateNotes];
}
