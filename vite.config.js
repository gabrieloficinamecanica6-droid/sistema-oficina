import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Oficina Pro — configurado como PWA instalável (Windows/tablet) e com
// fallback offline agressivo, já que a bancada da oficina pode ficar sem rede.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gabriel Oficina Mecânica',
        short_name: 'Gabriel Oficina',
        description: 'Gestão de Ordens de Serviço, estoque e fidelização — Gabriel Oficina Mecânica',
        theme_color: '#0B0D0F',
        background_color: '#0B0D0F',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Cache-first para os assets do app shell; garante abertura instantânea
        // mesmo sem internet. Dados (Firestore) são tratados pela persistência
        // do próprio SDK, não pelo Service Worker.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://firebasestorage.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'garantias-storage',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  }
});
