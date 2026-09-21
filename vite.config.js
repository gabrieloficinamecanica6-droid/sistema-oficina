import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/sistema-oficina/',

  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png'
      ],

      manifest: {
        name: 'Gabriel Oficina Mecânica',
        short_name: 'Gabriel Oficina',
        description: 'Gestão de Ordens de Serviço, estoque e fidelização — Gabriel Oficina Mecânica',
        theme_color: '#0B0D0F',
        background_color: '#0B0D0F',
        display: 'standalone',
        orientation: 'any',

        start_url: '/sistema-oficina/',

        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico}'
        ],

        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://firebasestorage.googleapis.com',

            handler: 'CacheFirst',

            options: {
              cacheName: 'garantias-storage',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
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
