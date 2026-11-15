// Per-serving macros for one recipe, from the pinned nutrition data. A plain
// synchronous calculation: no fetch, no loading state. Serving counts still
// come from estimateServings (passed in as servingEstimate).
//
// Returns computeMacros' result:
//   { status: 'none' }                      blank, Seasonings/Doughs, or no serving estimate
//   { status: 'skipped', reason }           the recipe is deliberately not estimated
//   { status: 'incomplete', missing }       unmapped ingredient lines (the build prevents this)
//   { status: 'ok', perServing, excluded, counted }

import { useMemo } from 'react';
import { computeRecipeMacros } from '../data/nutrition/index.js';

export function useMacroEstimate(recipe, servingEstimate) {
  const servings = servingEstimate?.servings;
  return useMemo(() => computeRecipeMacros(recipe, servings), [recipe, servings]);
}
