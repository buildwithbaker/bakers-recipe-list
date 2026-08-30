import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { migrateState } from './data/stateMigration.js';
import { installUpdateReload } from './utils/swUpdate.js';
import './styles/globals.css';

// Persisted state moves from name keys to id keys BEFORE the first render: the
// hooks read localStorage in their useState initialisers, so anything after
// this would load the old shape. No-ops once the version flag is current, and
// never throws — a failed migration retries next boot rather than blocking the
// app from starting.
migrateState();

// The worker self-activates on a new deploy but the injected registration
// script never tells an open page, so it keeps running the bundle it loaded.
// Reload once when a new worker takes control — never on the first visit,
// never over an open overlay, at most once per session. Runs after the
// migration above, which is idempotent and flag-gated, so a reload re-runs it
// as a no-op.
installUpdateReload();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
