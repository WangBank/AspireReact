import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const allowedHosts = [
  'lies.wangbank.top',
  ...((process.env.VITE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)),
];

const devApiTarget = process.env.SERVER_HTTPS || process.env.SERVER_HTTP || 'http://localhost:5515';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['github.svg', 'Lise.png', 'brand-mark.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        name: '心魔录',
        short_name: '心魔录',
        description: '交易复盘、OCR 录入与统计分析',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f8fa',
        theme_color: '#0d1117',
        lang: 'zh-CN',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,json}'],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    allowedHosts,
    proxy: {
      // Proxy API calls to the app service
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
    }
  }
});
