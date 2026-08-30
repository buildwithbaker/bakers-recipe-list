// The missing half of `registerType: 'autoUpdate'`.
//
// vite-plugin-pwa builds a worker that calls skipWaiting() + clientsClaim(), so
// a new deploy activates and takes control of open clients immediately. But the
// registration script it injects is a bare
// `navigator.serviceWorker.register(...)` with no reload path, so the page that
// is already open keeps executing the JS it parsed at load time. "Auto update"
// updates the WORKER, not the PAGE — an open client can run a shipped-days-ago
// bundle indefinitely, and every fix inherits that latency.
//
// This closes it: when a new worker takes control, reload once.
//
// Three things this must not do:
//   1. Reload on the FIRST visit. controllerchange also fires when a worker
//      claims a page for the very first time, which is a claim, not an update.
//      Only a page that was ALREADY controlled at install time can be stale.
//   2. Trap the user in a reload loop. Two latches — one per page life, one per
//      browsing session — so a pathological activate/claim cycle costs at most
//      one automatic reload per session.
//   3. Reload out from under an open overlay. Losing the card someone is
//      reading mid-recipe is worse than the staleness being fixed.

export const RELOAD_STAMP_KEY = 'brl_sw_reloaded';

// Overlay stack recorded on the current history entry by App.jsx. Same shape
// the app's own back-button model reads.
function overlaysOpen(history) {
  try {
    const list = history?.state?.overlays;
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

/**
 * Installs the update-reload listener.
 *
 * Every dependency is injectable so the latches can actually be asserted rather
 * than inferred.
 *
 * @returns {{status: 'installed'|'uncontrolled'|'unsupported'}}
 */
export function installUpdateReload({
  serviceWorker = globalThis.navigator?.serviceWorker,
  storage = globalThis.sessionStorage,
  history = globalThis.history,
  target = globalThis,
  reload = () => globalThis.location?.reload(),
  log = (msg) => globalThis.console?.info?.(msg),
} = {}) {
  // (d) Feature-detect. Absent API, or a page no worker controls, is a clean
  // no-op — never a throw.
  if (!serviceWorker || typeof serviceWorker.addEventListener !== 'function') {
    return { status: 'unsupported' };
  }
  if (!serviceWorker.controller) {
    // DO NOT REMOVE THIS GUARD. It looks redundant and is not.
    //
    // controllerchange fires in TWO situations: a new worker replacing an old
    // one (an update — what we want to reload for), and a worker claiming a
    // page that had none (the first visit — a claim, not an update). They are
    // indistinguishable from inside the event.
    //
    // Only a page that was ALREADY controlled when we installed can be running
    // stale code, so an uncontrolled page arms nothing. Delete this and every
    // first-time visitor gets a spurious reload on their very first page view.
    return { status: 'uncontrolled' };
  }

  // Latch 1: this page life reloads at most once.
  let reloadedThisLife = false;
  // Set when a controller change arrives while an overlay is open.
  let pendingReload = false;

  // Latch 2: at most one automatic reload per browsing session, so an
  // activate/claim cycle cannot reload repeatedly across reloads.
  const reloadedThisSession = () => {
    try { return storage?.getItem(RELOAD_STAMP_KEY) === '1'; } catch { return false; }
  };
  const stampSession = () => {
    try { storage?.setItem(RELOAD_STAMP_KEY, '1'); } catch { /* private mode / quota */ }
  };

  const performReload = () => {
    reloadedThisLife = true;
    stampSession();
    reload();
  };

  const onControllerChange = () => {
    if (reloadedThisLife) {
      log('sw update: already reloaded this page life, ignoring');
      return;
    }
    if (reloadedThisSession()) {
      log('sw update: already reloaded this session, ignoring');
      return;
    }
    // (c) Never reload over an open card, list or menu.
    if (overlaysOpen(history)) {
      pendingReload = true;
      log('sw update: overlay open, deferring reload');
      return;
    }
    performReload();
  };

  // The deferred path. popstate is the app's own source of truth for which
  // layers are open, and closing an overlay steps back through its entry, so
  // this fires exactly when the stack drains.
  //
  // Edge: closeOverlay falls back to replaceState when history.state has been
  // lost, which emits no event. The reload then simply waits for the next
  // popstate or the user's next navigation — i.e. it degrades to the old
  // behaviour rather than reloading at a bad moment.
  const onPopState = () => {
    if (!pendingReload) return;
    if (overlaysOpen(history)) return;
    pendingReload = false;
    if (reloadedThisLife || reloadedThisSession()) return;
    performReload();
  };

  serviceWorker.addEventListener('controllerchange', onControllerChange);
  target?.addEventListener?.('popstate', onPopState);

  return { status: 'installed' };
}
