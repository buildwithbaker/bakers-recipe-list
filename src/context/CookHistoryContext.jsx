// CookHistoryContext: provides { madeSet, toggleMade } to the entire tree.
// RecipeRow reads from this context directly — no prop drilling through
// RecipeList or SectionBlock, which means SectionBlock's memo is never
// busted by a toggle (SectionBlock receives no madeSet prop at all).
import { createContext, useContext, useMemo } from 'react';
import { useCookHistory } from '../hooks/useCookHistory.js';

const CookHistoryContext = createContext({ madeSet: new Set(), toggleMade: () => {} });

export function CookHistoryProvider({ children }) {
  const [madeSet, toggleMade] = useCookHistory();
  // Memoize the context value so identity only changes when actual data changes,
  // not on every parent re-render. toggleMade is stable (useCallback); madeSet
  // is a new Set on each toggle as expected.
  const value = useMemo(() => ({ madeSet, toggleMade }), [madeSet, toggleMade]);
  return (
    <CookHistoryContext.Provider value={value}>
      {children}
    </CookHistoryContext.Provider>
  );
}

export function useCookHistoryContext() {
  return useContext(CookHistoryContext);
}
