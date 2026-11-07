// Toast: one short line at the bottom of the screen, read out by a screen
// reader (role="status"), gone after a few seconds. Returns [node, show]:
// render the node once, call show(text) to say something.
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../styles/toast.module.css';

export function useToast() {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  const show = useCallback((text) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className={styles.toastSlot} role="status" aria-live="polite">
      {message && <div className={styles.toast}>{message}</div>}
    </div>
  );
  return [node, show];
}
