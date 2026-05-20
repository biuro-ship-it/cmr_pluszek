import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Włącz devOptions żeby testować service worker w trybie dev
      devOptions: {
        enabled: false,
      },
      workbox: {
        // Cache plików statycznych (JS, CSS, fonts, ikony)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Strategie cache dla API — network first (świeże dane), fallback na cache
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/crm\.pluszek\.pl\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache zdjęć produktów z Firebase Storage
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dni
              },
            },
          },
        ],
      },
      manifest: {
        name: 'CRM Pluszek',
        short_name: 'CRM',
        description: 'System CRM dla firmy Pluszek — zarządzaj klientami, promocjami i produktami',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'pl',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Klienci',
            short_name: 'Klienci',
            description: 'Otwórz bazę klientów',
            url: '/?tab=clients',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Nowa promocja',
            short_name: 'Promocja',
            description: 'Utwórz nową promocję',
            url: '/?tab=promotions',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
