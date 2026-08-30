import { describe, it, expect } from 'vitest';
import { installUpdateReload, RELOAD_STAMP_KEY } from './swUpdate.js';

// Minimal event target — avoids assuming anything about the Node DOM shims.
function emitter() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    emit(type) {
      for (const fn of handlers.get(type) ?? []) fn();
    },
    count(type) {
      return (handlers.get(type) ?? []).length;
    },
  };
}

function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    snapshot: () => Object.fromEntries(data),
  };
}

// `sw` is the serviceWorker container, `win` the popstate target.
function harness({ controller = {}, overlays = [], session = {} } = {}) {
  const sw = emitter();
  sw.controller = controller;
  const win = emitter();
  const storage = fakeStorage(session);
  const history = { state: overlays.length ? { overlays } : null };
  const reloads = [];
  const logs = [];

  const result = installUpdateReload({
    serviceWorker: sw,
    storage,
    history,
    target: win,
    reload: () => reloads.push(1),
    log: (m) => logs.push(m),
  });

  return {
    sw, win, storage, history, reloads, logs, result,
    // Simulate the app closing an overlay: the stack drains, then popstate.
    closeOverlays() {
      history.state = { overlays: [] };
      win.emit('popstate');
    },
  };
}

describe('installUpdateReload', () => {
  it('reloads exactly once when a new worker takes control', () => {
    const h = harness();
    expect(h.result.status).toBe('installed');
    expect(h.reloads).toHaveLength(0);

    h.sw.emit('controllerchange');

    expect(h.reloads).toHaveLength(1);
    expect(h.storage.getItem(RELOAD_STAMP_KEY)).toBe('1');
  });

  it('does not reload while a recipe card is open, then reloads once it closes', () => {
    const h = harness({ overlays: ['recipe:tandoori-chicken-marinade'] });

    h.sw.emit('controllerchange');
    expect(h.reloads).toHaveLength(0);                    // deferred, not dropped
    expect(h.logs.join(' ')).toMatch(/deferring/);

    h.closeOverlays();
    expect(h.reloads).toHaveLength(1);
  });

  it('keeps deferring while any layer remains on the stack', () => {
    // Card with the shopping list stacked on top of it.
    const h = harness({ overlays: ['recipe:x', 'list'] });
    h.sw.emit('controllerchange');
    expect(h.reloads).toHaveLength(0);

    // Back closes the list; the card is still open.
    h.history.state = { overlays: ['recipe:x'] };
    h.win.emit('popstate');
    expect(h.reloads).toHaveLength(0);

    // Back again closes the card.
    h.closeOverlays();
    expect(h.reloads).toHaveLength(1);
  });

  it('reloads once, not twice, when the deferred stack drains repeatedly', () => {
    const h = harness({ overlays: ['recipe:x'] });
    h.sw.emit('controllerchange');
    h.closeOverlays();
    h.closeOverlays();
    h.win.emit('popstate');
    expect(h.reloads).toHaveLength(1);
  });

  // Latch 1 — one page life.
  it('reloads once when controllerchange fires twice in one page life', () => {
    const h = harness();
    h.sw.emit('controllerchange');
    h.sw.emit('controllerchange');
    h.sw.emit('controllerchange');
    expect(h.reloads).toHaveLength(1);
    expect(h.logs.join(' ')).toMatch(/already reloaded this page life/);
  });

  // Latch 2 — one browsing session, surviving the reload itself.
  it('does not reload again after the reload, in the same session', () => {
    const first = harness();
    first.sw.emit('controllerchange');
    expect(first.reloads).toHaveLength(1);

    // The reload happens: a fresh page life, same sessionStorage.
    const second = harness({ session: first.storage.snapshot() });
    second.sw.emit('controllerchange');
    second.sw.emit('controllerchange');

    expect(second.reloads).toHaveLength(0);
    expect(second.logs.join(' ')).toMatch(/already reloaded this session/);
  });

  it('honours the session latch even on the deferred path', () => {
    const h = harness({
      overlays: ['recipe:x'],
      session: { [RELOAD_STAMP_KEY]: '1' },
    });
    h.sw.emit('controllerchange');
    h.closeOverlays();
    expect(h.reloads).toHaveLength(0);
  });

  // (d) Feature detection — every one of these is a clean no-op, not a throw.
  it('no-ops when the page is not controlled by a worker (first visit)', () => {
    const h = harness({ controller: null });
    expect(h.result.status).toBe('uncontrolled');
    // The initial claim must not reload a first-time visitor.
    h.sw.emit('controllerchange');
    expect(h.reloads).toHaveLength(0);
    expect(h.sw.count('controllerchange')).toBe(0);       // listener never attached
  });

  it('no-ops when serviceWorker is unavailable', () => {
    expect(installUpdateReload({ serviceWorker: undefined }).status).toBe('unsupported');
    expect(installUpdateReload({ serviceWorker: {} }).status).toBe('unsupported');
  });

  it('does not throw when sessionStorage is unavailable or blocked', () => {
    const blocked = {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
    };
    const sw = emitter();
    sw.controller = {};
    const reloads = [];
    installUpdateReload({
      serviceWorker: sw,
      storage: blocked,
      history: { state: null },
      target: emitter(),
      reload: () => reloads.push(1),
      log: () => {},
    });
    expect(() => sw.emit('controllerchange')).not.toThrow();
    expect(reloads).toHaveLength(1);   // storage failure must not block the reload
  });

  it('treats an unreadable history.state as "no overlay open"', () => {
    const sw = emitter();
    sw.controller = {};
    const reloads = [];
    installUpdateReload({
      serviceWorker: sw,
      storage: fakeStorage(),
      history: { get state() { throw new Error('blocked'); } },
      target: emitter(),
      reload: () => reloads.push(1),
      log: () => {},
    });
    expect(() => sw.emit('controllerchange')).not.toThrow();
    expect(reloads).toHaveLength(1);
  });
});
