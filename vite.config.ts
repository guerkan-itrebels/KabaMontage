/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Für GitHub Pages: Repository-Name als Basispfad. Über BASE_PATH überschreibbar.
const base = process.env.BASE_PATH ?? '/KabaMontage/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? base : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'KabaMontage Rechnungen',
        short_name: 'KabaMontage',
        description: 'Angebote, Rechnungen und Zeiterfassung – offline auf dem Handy',
        lang: 'de',
        theme_color: '#0f1c2e',
        background_color: '#0f1c2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
