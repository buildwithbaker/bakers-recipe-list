/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/bakers-recipe-list/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // Silent auto-update: a new deploy installs and takes over in the
      // background, then reloads the page. No user prompt.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Extra static assets (from public/) to precache alongside the build.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // woff2 is the self-hosted heading font; without it an offline visit
        // falls back to Georgia. The .woff twin is never fetched by a browser
        // that reads woff2, so it is left out of the precache.
        // Card thumbnails (src/photos/ via build-photos.mjs) are ~15 KB each, so
        // they are precached and the list looks right offline. The 800px
        // recipe photos are cached the first time each is viewed instead.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}', '**/*-thumb-*.webp'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${BASE}assets/`) && /-large-[^/]*\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'brl-photos', expiration: { maxEntries: 300 } },
          },
        ],
        // The recipe data (~0.5 MB) is bundled into the main JS chunk, so the
        // precache entry can exceed the 2 MiB default. Raise the ceiling.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // A repeat visit with the service worker active serves the cached shell
        // for /r/<slug>/ too, not the prerendered file — which is correct: the
        // app routes from location.pathname, and a crawler never has a worker.
        navigateFallback: `${BASE}index.html`,
      },
      manifest: {
        name: "Baker's Recipe List",
        short_name: 'Recipes',
        description:
          "Baker's Recipe List — a personal recipe collection with search, serving scaler, and automatic macro & nutrition estimates.",
        id: BASE,
        scope: BASE,
        start_url: BASE,
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#1f3a5f',
        background_color: '#f3ebdc',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        // Keep the SW off during `npm run dev` to avoid stale-cache confusion.
        enabled: false,
      },
    }),
  ],
  test: {
    // The suite covers pure utils + a data-integrity check — no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
