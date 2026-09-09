// The Screen Wake Lock lifecycle, with no React in it.
//
// Split out of useWakeLock so the part that is easy to get wrong can actually
// be tested. The behaviour that matters is not "can we take a lock" — it is
// what happens AFTER the browser silently takes it back, which it does every
// time the document stops being visible. That path only runs on a real phone
// screen going to sleep, so without a seam here it would ship untested.
//
// Everything the controller touches is injected, so a test can hand it a fake
// navigator and document and drive the visibility transitions directly.

export function supportsScreenLock(nav) {
  return !!nav && 'wakeLock' in nav;
}

/**
 * @param nav       a navigator-like object
 * @param doc       a document-like object (visibilityState + event listeners)
 * @param onChange  called with the user's INTENT whenever it changes, not with
 *                  whether a lock is currently held — the browser dropping the
 *                  lock behind our back must not flip the control off
 * @returns { supported, enable, disable, isHeld, isWanted, destroy }
 */
export function createScreenLock(nav, doc, onChange = () => {}) {
  const supported = supportsScreenLock(nav);
  let sentinel = null;
  let wanted = false;

  async function acquire() {
    if (!supported || sentinel) return false;
    try {
      // Rejects when the document is hidden, and in some browsers when the call
      // is not tied to a user gesture. Both are ordinary here; an unhandled
      // rejection would reach the user as a toggle that silently does nothing.
      const granted = await nav.wakeLock.request('screen');
      sentinel = granted;
      // The browser fires this when it takes the lock back. Dropping our handle
      // is what lets the visibility listener know there is work to redo.
      granted.addEventListener?.('release', () => {
        if (sentinel === granted) sentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  async function releaseSentinel() {
    const held = sentinel;
    sentinel = null;
    if (!held) return;
    // Already released by the browser is the normal case, not an error.
    try { await held.release(); } catch { /* ignore */ }
  }

  const onVisibilityChange = () => {
    if (doc.visibilityState !== 'visible') return;
    if (!wanted || sentinel) return;
    acquire();
  };

  if (supported) doc.addEventListener('visibilitychange', onVisibilityChange);

  return {
    supported,

    // Only reports success if the lock was really granted — showing "on" over a
    // screen that still sleeps is worse than showing nothing at all.
    async enable() {
      const granted = await acquire();
      wanted = granted;
      onChange(granted);
      return granted;
    },

    async disable() {
      wanted = false;
      onChange(false);
      await releaseSentinel();
    },

    isHeld: () => sentinel !== null,
    isWanted: () => wanted,

    destroy() {
      wanted = false;
      if (supported) doc.removeEventListener('visibilitychange', onVisibilityChange);
      releaseSentinel();
    },
  };
}
