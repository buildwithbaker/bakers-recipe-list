// Shopping list — persisted to localStorage.
// Items are grouped by recipe id (ShoppingList resolves the label). Checked
// items are crossed out but kept
// until explicitly cleared so the user can shop at their own pace.
//
// schema: [{ id, text, recipe (recipe id), checked }]

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'brl_shopping_list';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  catch { /* quota — ignore */ }
}

let idCounter = Date.now();
function nextId() { return String(++idCounter); }

export function useShoppingList() {
  const [items, setItems] = useState(load);

  // Add all ingredients from a recipe (already scaled text).
  const addItems = useCallback((recipeId, scaledTexts) => {
    setItems((prev) => {
      // Remove existing items from the same recipe so re-adding replaces them.
      const without = prev.filter((it) => it.recipe !== recipeId);
      const added = scaledTexts.map((text) => ({
        id: nextId(),
        text,
        recipe: recipeId,
        checked: false,
      }));
      const next = [...without, ...added];
      save(next);
      return next;
    });
  }, []);

  const toggleItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.map((it) => it.id === id ? { ...it, checked: !it.checked } : it);
      save(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      save(next);
      return next;
    });
  }, []);

  const clearChecked = useCallback(() => {
    setItems((prev) => {
      const next = prev.filter((it) => !it.checked);
      save(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    save([]);
    setItems([]);
  }, []);

  return [items, addItems, toggleItem, removeItem, clearChecked, clearAll];
}
