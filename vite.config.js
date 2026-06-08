/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/bakers-recipe-list/',
  test: {
    // The suite covers pure utils + a data-integrity check — no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
