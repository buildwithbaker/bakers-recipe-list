// Cook mode: hold the screen awake while a recipe is open.
//
// Cooking is the one time a recipe is read from across a counter with wet
// hands, and the one time the screen timeout is actively hostile.
//
// The lifecycle lives in src/utils/screenLock.js, which takes its navigator and
// document as arguments so the awkward part — the browser silently dropping the
// lock every time the document stops being visible, and it NOT coming back on
// its own — can be tested without a phone. A naive version works until the
// first time the screen sleeps, which is exactly the moment cook mode exists
// for. This hook is the React wrapper over that.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createScreenLock, supportsScreenLock } from '../utils/screenLock.js';

// Read once, at module load. Safari only shipped this in 16.4 and no polyfill
// is possible, so the caller renders no control at all rather than a dead one.
const SUPPORTED = typeof navigator !== 'undefined' && supportsScreenLock(navigator);

export function useWakeLock() {
  const [active, setActive] = useState(false);
  const lockRef = useRef(null);

  useEffect(() => {
    if (!SUPPORTED) return undefined;
    const lock = createScreenLock(navigator, document, setActive);
    lockRef.current = lock;
    // Releasing on unmount is also what stops cook mode persisting from one
    // recipe to the next: App.jsx keys the recipe's ErrorBoundary on the recipe
    // id, so switching recipes remounts this, and closing the recipe unmounts
    // it outright.
    return () => {
      lockRef.current = null;
      lock.destroy();
    };
  }, []);

  const toggle = useCallback(() => {
    const lock = lockRef.current;
    if (!lock) return;
    if (lock.isWanted()) lock.disable(); else lock.enable();
  }, []);

  return { supported: SUPPORTED, active, toggle };
}
