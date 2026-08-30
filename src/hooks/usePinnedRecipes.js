// Tracks recipes the user wants to cook soon — distinct from "made".
// Same Set-in-localStorage pattern as useCookHistory.

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'brl_pinned_v1';

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

export function usePinnedRecipes() {
  const [pinnedSet, setPinnedSet] = useState(load);

  const togglePinned = useCallback((recipeId) => {
    setPinnedSet((prev) => {
      const next = new Set(prev);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      save(next);
      return next;
    });
  }, []);

  return [pinnedSet, togglePinned];
}
