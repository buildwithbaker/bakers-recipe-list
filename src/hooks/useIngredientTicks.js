// Ingredient ticks: tap a line to mark it gathered or used while cooking.
//
// Kept for the browser session, per recipe, so a reload mid-cook (including the
// one-off service-worker update reload) does not wipe your place. Not kept
// longer: next time you cook it, the list starts clean.
import { useCallback, useState } from 'react';

const KEY = 'brl_ingredient_ticks';

function readAll() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

function saveTicks(recipeId, ticks) {
  const all = readAll();
  if (ticks.size) all[recipeId] = [...ticks]; else delete all[recipeId];
  try { sessionStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode / quota */ }
}

export function useIngredientTicks(recipeId) {
  const [ticks, setTicks] = useState(() => new Set(readAll()[recipeId] ?? []));

  const toggle = useCallback((index) => {
    setTicks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      saveTicks(recipeId, next);
      return next;
    });
  }, [recipeId]);

  const clear = useCallback(() => {
    saveTicks(recipeId, new Set());
    setTicks(new Set());
  }, [recipeId]);

  return [ticks, toggle, clear];
}
