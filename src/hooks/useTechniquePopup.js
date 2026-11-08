// Open/close state for a technique popup, tied to the browser's history so the
// Back button closes the popup and leaves the reader on the recipe, at the same
// scroll position.
//
//   open   pushes ONE history entry (same URL, same state plus `technique`)
//   Back   pops it; the popstate listener below closes the popup
//   close  (X, scrim, Esc) steps Back through that same entry, so history never
//          piles up; if the entry's state was lost it just closes
//   leave  strips the marker from the current entry in place, for a navigation
//          that is about to push a new entry on top (so Back from there lands
//          on the recipe with the popup closed, not on a stale marked entry)
//
// App.jsx's popstate handler reads path, overlays, page and tab off the entry;
// all of those are carried over unchanged, so it sees no change and the recipe
// stays put. The marker is read back from history.state too, so Forward and a
// reload restore a popup that was open.
import { useCallback, useEffect, useRef, useState } from 'react';

export const TECHNIQUE_KEY = 'technique';

const markedId = () => {
  try {
    const id = window.history.state?.[TECHNIQUE_KEY];
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
};

export function useTechniquePopup() {
  const [openId, setOpenId] = useState(markedId);
  // The control that opened the popup, so focus can go back to it.
  const openerRef = useRef(null);

  const open = useCallback((id, opener) => {
    openerRef.current = opener ?? null;
    try {
      window.history.pushState({ ...window.history.state, [TECHNIQUE_KEY]: id }, '', window.location.href);
    } catch { /* ignore: the popup still opens, it just has no Back stop */ }
    setOpenId(id);
  }, []);

  const close = useCallback(() => {
    if (markedId()) {
      try { window.history.back(); return; } catch { /* fall through */ }
    }
    setOpenId(null);
  }, []);

  const leave = useCallback(() => {
    try {
      if (markedId()) {
        const { [TECHNIQUE_KEY]: _marker, ...rest } = window.history.state;
        window.history.replaceState(rest, '', window.location.href);
      }
    } catch { /* ignore */ }
    setOpenId(null);
  }, []);

  useEffect(() => {
    const onPop = () => setOpenId(markedId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return { openId, openerRef, open, close, leave };
}
