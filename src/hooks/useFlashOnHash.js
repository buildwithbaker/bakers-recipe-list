// One shared window 'hashchange' listener across all callers.
// Uses a reference count instead of a boolean flag so React Strict Mode's
// double-invoke (unmount + remount) doesn't leave the listener detached.
import { useEffect } from 'react';

const subscribers = new Set();
let listenerCount = 0;

function broadcast() {
  const hash = window.location.hash;
  subscribers.forEach((fn) => fn(hash));
}

export function useFlashOnHash(sectionId, onFlash) {
  useEffect(() => {
    const handler = (hash) => { if (hash === `#${sectionId}`) onFlash(); };
    subscribers.add(handler);
    listenerCount++;
    if (listenerCount === 1) window.addEventListener('hashchange', broadcast);

    // Handle direct hash URL loads and page reload with hash.
    if (window.location.hash === `#${sectionId}`) onFlash();

    return () => {
      subscribers.delete(handler);
      listenerCount--;
      if (listenerCount === 0) window.removeEventListener('hashchange', broadcast);
    };
  }, [sectionId, onFlash]);
}
