import { describe, it, expect, vi } from 'vitest';
import { createScreenLock, supportsScreenLock } from './screenLock.js';

// A document whose visibility the test drives directly — the whole point is to
// exercise the transitions that only happen on a real phone screen sleeping.
function fakeDoc() {
  const listeners = new Set();
  return {
    visibilityState: 'visible',
    addEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.delete(fn); },
    listenerCount: () => listeners.size,
    async setVisibility(state) {
      this.visibilityState = state;
      for (const fn of listeners) fn();
      // let the async acquire inside the listener settle
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

// A navigator whose wakeLock hands out sentinels the test can "have taken back"
// the way a browser does.
function fakeNav({ failNext = false } = {}) {
  const granted = [];
  let shouldFail = failNext;
  const nav = {
    wakeLock: {
      request: vi.fn(async () => {
        if (shouldFail) { shouldFail = false; throw new Error('NotAllowedError'); }
        const releaseListeners = new Set();
        const sentinel = {
          released: false,
          addEventListener: (t, fn) => { if (t === 'release') releaseListeners.add(fn); },
          release: vi.fn(async () => { sentinel.released = true; }),
          // What the browser does when the document is hidden.
          browserRevokes: () => { sentinel.released = true; releaseListeners.forEach((fn) => fn()); },
        };
        granted.push(sentinel);
        return sentinel;
      }),
    },
    granted,
    failOnce: () => { shouldFail = true; },
  };
  return nav;
}

describe('supportsScreenLock', () => {
  it('detects the API', () => {
    expect(supportsScreenLock({ wakeLock: {} })).toBe(true);
    expect(supportsScreenLock({})).toBe(false);
    expect(supportsScreenLock(null)).toBe(false);
  });
});

describe('createScreenLock', () => {
  it('takes a lock on enable and reports the intent', async () => {
    const nav = fakeNav();
    const onChange = vi.fn();
    const lock = createScreenLock(nav, fakeDoc(), onChange);
    await lock.enable();
    expect(nav.wakeLock.request).toHaveBeenCalledWith('screen');
    expect(lock.isHeld()).toBe(true);
    expect(lock.isWanted()).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not claim to be on when the request is refused', async () => {
    const nav = fakeNav({ failNext: true });
    const onChange = vi.fn();
    const lock = createScreenLock(nav, fakeDoc(), onChange);
    expect(await lock.enable()).toBe(false);
    expect(lock.isWanted()).toBe(false);
    expect(lock.isHeld()).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('releases on disable', async () => {
    const nav = fakeNav();
    const lock = createScreenLock(nav, fakeDoc());
    await lock.enable();
    await lock.disable();
    expect(nav.granted[0].release).toHaveBeenCalled();
    expect(lock.isHeld()).toBe(false);
    expect(lock.isWanted()).toBe(false);
  });

  // THE ONE THAT MATTERS: the phone locks, the browser takes the lock back, the
  // phone is woken. Cook mode has to still be on.
  it('re-acquires after the browser revokes the lock and the page returns', async () => {
    const nav = fakeNav();
    const doc = fakeDoc();
    const lock = createScreenLock(nav, doc, () => {});
    await lock.enable();

    // Screen sleeps: browser revokes, page goes hidden.
    nav.granted[0].browserRevokes();
    await doc.setVisibility('hidden');
    expect(lock.isHeld()).toBe(false);
    // Intent survives — the control must not silently flip itself off.
    expect(lock.isWanted()).toBe(true);

    // Woken.
    await doc.setVisibility('visible');
    expect(nav.wakeLock.request).toHaveBeenCalledTimes(2);
    expect(lock.isHeld()).toBe(true);
  });

  it('does not re-acquire once the user has switched it off', async () => {
    const nav = fakeNav();
    const doc = fakeDoc();
    const lock = createScreenLock(nav, doc);
    await lock.enable();
    await lock.disable();
    await doc.setVisibility('hidden');
    await doc.setVisibility('visible');
    expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it('does not re-acquire while a lock is still held', async () => {
    const nav = fakeNav();
    const doc = fakeDoc();
    const lock = createScreenLock(nav, doc);
    await lock.enable();
    await doc.setVisibility('visible');
    expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it('survives a re-acquire that is refused, and retries on the next return', async () => {
    const nav = fakeNav();
    const doc = fakeDoc();
    const lock = createScreenLock(nav, doc);
    await lock.enable();
    nav.granted[0].browserRevokes();
    nav.failOnce();
    await doc.setVisibility('visible');
    expect(lock.isHeld()).toBe(false);
    expect(lock.isWanted()).toBe(true);
    await doc.setVisibility('visible');
    expect(lock.isHeld()).toBe(true);
  });

  it('does nothing at all when the API is missing', async () => {
    const doc = fakeDoc();
    const lock = createScreenLock({}, doc);
    expect(lock.supported).toBe(false);
    expect(await lock.enable()).toBe(false);
    // No listener is attached, so nothing runs on visibility changes either.
    expect(doc.listenerCount()).toBe(0);
  });

  it('unhooks and releases on destroy', async () => {
    const nav = fakeNav();
    const doc = fakeDoc();
    const lock = createScreenLock(nav, doc);
    await lock.enable();
    const sentinel = nav.granted[0];
    lock.destroy();
    await Promise.resolve();
    expect(doc.listenerCount()).toBe(0);
    expect(sentinel.release).toHaveBeenCalled();
    expect(lock.isWanted()).toBe(false);
  });
});
