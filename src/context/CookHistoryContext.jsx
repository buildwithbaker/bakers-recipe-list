import { createContext, useCallback, useContext, useMemo } from 'react';
import { useCookHistory } from '../hooks/useCookHistory.js';
import { useCookLog } from '../hooks/useCookLog.js';
import { usePinnedRecipes } from '../hooks/usePinnedRecipes.js';

const CookHistoryContext = createContext({
  madeSet: new Set(),
  toggleMade: () => {},
  cookLog: {},
  logCook: () => {},
  updateNotes: () => {},
  pinnedSet: new Set(),
  togglePinned: () => {},
});

export function CookHistoryProvider({ children }) {
  const [madeSet, toggleMadeRaw] = useCookHistory();
  const [cookLog, logCook, updateNotes] = useCookLog();
  const [pinnedSet, togglePinned] = usePinnedRecipes();

  // Wrap toggleMade so the first time a recipe is ever marked made also logs a
  // dated cook entry. Only the first time: repeat cooks use the explicit
  // "+ Log cook" button, so toggling made off→on→off→on no longer inflates the
  // "Cooked N×" count.
  const toggleMade = useCallback((name) => {
    const wasAlreadyMade = madeSet.has(name);
    const hasCookHistory = (cookLog[name]?.dates?.length ?? 0) > 0;
    toggleMadeRaw(name);
    if (!wasAlreadyMade && !hasCookHistory) logCook(name);
  }, [madeSet, cookLog, toggleMadeRaw, logCook]);

  const value = useMemo(
    () => ({ madeSet, toggleMade, cookLog, logCook, updateNotes, pinnedSet, togglePinned }),
    [madeSet, toggleMade, cookLog, logCook, updateNotes, pinnedSet, togglePinned]
  );

  return (
    <CookHistoryContext.Provider value={value}>
      {children}
    </CookHistoryContext.Provider>
  );
}

export function useCookHistoryContext() {
  return useContext(CookHistoryContext);
}
