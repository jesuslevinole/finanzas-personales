import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Bolívar Vivo — Finanzas personales',
        short_name: 'Bolívar Vivo',
        description: 'Registra en bolívares, piensa en dólares. Control de gastos, deudas y compras contra la inflación.',
        theme_color: '#5b3df5',
        background_color: '#f5f6fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es-VE',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El shell de la app se sirve desde caché: abre al instante y sin red.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fuentes', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // La tasa del día: red primero, con la última respuesta como respaldo.
            urlPattern: /^https:\/\/ve\.dolarapi\.com\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'tasa-bcv', networkTimeoutSeconds: 5, expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 12 } },
          },
        ],
        // Firestore maneja su propia caché en IndexedDB; no la interceptamos.
        navigateFallbackDenylist: [/^\/__/, /firestore/],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Trozos separados: el usuario descarga solo lo que usa.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
