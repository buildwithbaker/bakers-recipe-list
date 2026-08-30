import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { migrateState } from './data/stateMigration.js';
import './styles/globals.css';

// Persisted state moves from name keys to id keys BEFORE the first render: the
// hooks read localStorage in their useState initialisers, so anything after
// this would load the old shape. No-ops once the version flag is current, and
// never throws — a failed migration retries next boot rather than blocking the
// app from starting.
migrateState();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
