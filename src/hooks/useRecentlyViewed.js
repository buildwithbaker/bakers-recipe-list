// Tracks the last N recipes opened by the user, persisted to localStorage.
// Returns [history, addToHistory] where:
//   history — array of recipe objects (most recent first, max 5)
//   addToHistory(recipe) — adds a recipe to the front, deduplicates by name

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'brl_recently_viewed';
const MAX = 5;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota exceeded — ignore */ }
}

export function useRecentlyViewed() {
  const [history, setHistory] = useState(loadHistory);

  const addToHistory = useCallback((recipe) => {
    setHistory((prev) => {
      // Deduplicate: remove any existing entry for this recipe name.
      const deduped = prev.filter((r) => r.name !== recipe.name);
      // Prepend the new recipe, cap at MAX.
      const next = [{ name: recipe.name, section: recipe.section }, ...deduped].slice(0, MAX);
      saveHistory(next);
      return next;
    });
  }, []);

  return [history, addToHistory];
}
