// Traps Tab focus inside a container element while `active` is true.
// Standard accessible modal pattern: Tab wraps from last → first,
// Shift+Tab wraps from first → last.
import { useEffect } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function useFocusTrap(containerRef, active) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = [...container.querySelectorAll(FOCUSABLE_SELECTORS)]
        .filter((el) => el.offsetParent !== null); // exclude hidden elements
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [containerRef, active]);
}
