// Custom hook: manages the full USDA macro estimation pipeline for a single recipe.
// Encapsulates the async fetch, cancellation, rate-limit detection, and all state
// transitions so RecipeModal only has to call one hook and render the result.
//
// Returns { status, macros, matchedCount, totalCount } — same shape MacroCard expects.
//
// status values:
//   'unavailable'  — recipe excluded (Seasonings/Doughs), blank, no serving estimate,
//                    or no ingredients could be matched
//   'loading'      — fetch in flight
//   'done'         — macros ready
//   'rate-limited' — USDA API rate limit hit this session
//   'error'        — unexpected fetch failure

import { useEffect, useReducer } from 'react';
import { estimateMacros } from '../utils/estimateMacros.js';

// Sections where macro estimation does not apply.
const EXCLUDED_SECTIONS = new Set(['SEASONINGS', 'DOUGHS']);

const INITIAL = { status: 'unavailable', macros: null, matchedCount: 0, totalCount: 0 };

function reducer(state, action) {
  switch (action.type) {
    case 'UNAVAILABLE':  return INITIAL;
    case 'LOADING':      return { ...INITIAL, status: 'loading' };
    case 'RATE_LIMITED': return { ...INITIAL, status: 'rate-limited' };
    case 'ERROR':        return { ...INITIAL, status: 'error' };
    case 'DONE':         return {
      status: 'done',
      macros: action.macros,
      matchedCount: action.matchedCount,
      totalCount: action.totalCount,
    };
    default: return state;
  }
}

export function useMacroEstimate(recipe, servingEstimate) {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  useEffect(() => {
    if (!recipe || recipe.is_blank || EXCLUDED_SECTIONS.has(recipe.section) || !servingEstimate) {
      dispatch({ type: 'UNAVAILABLE' });
      return;
    }

    // AbortController lets us actually cancel in-flight USDA fetch calls when
    // the user switches recipes — not just ignore the stale response on arrival.
    const controller = new AbortController();
    dispatch({ type: 'LOADING' });

    estimateMacros(recipe, servingEstimate.servings, controller.signal)
      .then((macros) => {
        if (controller.signal.aborted) return;
        if (!macros) { dispatch({ type: 'UNAVAILABLE' }); return; }
        if (macros.matchedCount === 0) {
          dispatch({ type: macros.rateLimited ? 'RATE_LIMITED' : 'UNAVAILABLE' });
          return;
        }
        dispatch({
          type: 'DONE',
          macros,
          matchedCount: macros.matchedCount,
          totalCount: macros.totalCount,
        });
      })
      .catch((err) => {
        // AbortError is expected on cleanup — don't surface it as an error state.
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        dispatch({ type: 'ERROR' });
      });

    // Cleanup: abort any in-flight network requests for the previous recipe.
    return () => { controller.abort(); };
  }, [recipe, servingEstimate]);

  return state;
}
