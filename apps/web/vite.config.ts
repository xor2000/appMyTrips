import adapter from '@sveltejs/adapter-static';
import { svelteTesting } from '@testing-library/svelte/vite';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    withPwa(
      // Configuration SvelteKit 3 (remplace svelte.config.js).
      {
        // SPA : toutes les routes inconnues retombent sur index.html, servi par le Worker.
        adapter: adapter({ fallback: 'index.html' }),
        serviceWorker: { register: false },
      },
      // Configuration PWA (Workbox generateSW).
      {
        strategies: 'generateSW',
        registerType: 'prompt',
        kit: { adapterFallback: 'index.html', spa: true },
        manifest: {
          name: 'MyTrips',
          short_name: 'MyTrips',
          description: 'Organiser ses voyages : jours, étapes, trajets et carte.',
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#0b8f94',
          background_color: '#f7f5ff',
          icons: [
            { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        generateSW: {
          // Pas de prérendu en SPA : on ne précache que les fichiers client (la coquille
          // index.html est ajoutée par l'option kit.spa).
          globPatterns: ['client/**/*.{js,mjs,css,ico,png,svg,webp,webmanifest,woff2}'],
          // Le plugin ajoute toujours « prerendered/** », vide en SPA : ne pas en faire une erreur.
          globStrict: false,
          // La navigation hors ligne ne doit jamais retomber sur la coquille pour /api.
          navigateFallbackDenylist: [/^\/api\//],
          // Consultation hors ligne : carte mise en cache au fil de la navigation et par
          // « Préparer hors ligne ». Les données de l'API vont dans IndexedDB (avec leur date),
          // jamais dans ce cache, pour ne pas présenter une ancienne réponse comme fraîche.
          runtimeCaching: [
            {
              // Style, sprites, polices et TileJSON d'OpenFreeMap.
              urlPattern:
                /^https:\/\/tiles\.openfreemap\.org\/(styles|sprites|fonts)\/|^https:\/\/tiles\.openfreemap\.org\/planet$/,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'ofm-assets', cacheableResponse: { statuses: [0, 200] } },
            },
            {
              // Tuiles OpenFreeMap (vectorielles et fond raster) : même nom que TILE_CACHE.
              urlPattern: /^https:\/\/tiles\.openfreemap\.org\/(planet|natural_earth)\/.+/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ofm-tiles',
                expiration: { maxEntries: 20_000, maxAgeSeconds: 60 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/[abc]\.tile\.opentopomap\.org\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'topo-tiles',
                expiration: { maxEntries: 5000, maxAgeSeconds: 60 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Vignettes Wikipédia de la découverte de lieux.
              urlPattern: /^https:\/\/upload\.wikimedia\.org\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'wiki-thumbnails',
                expiration: { maxEntries: 500 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      },
    ),
    svelteTesting(),
  ],
  // En dev, le front (Vite) relaie /api vers le Worker local (wrangler dev, port 8787 par défaut ;
  // MYTRIPS_API_URL permet d'en changer si le port est déjà pris).
  server: {
    proxy: { '/api': process.env.MYTRIPS_API_URL ?? 'http://localhost:8787' },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
