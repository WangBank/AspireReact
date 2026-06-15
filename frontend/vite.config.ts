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
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['github.svg', 'Lies.png', 'brand-mark.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        id: '/',
        name: 'Lies',
        short_name: 'Lies',
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
      // VSCode/AppHost 本地开发使用的是 Vite dev server，
      // 这里必须启用 dev PWA，否则 manifest 与 sw.js 会回退成 index.html。
      devOptions: {
        enabled: command === 'serve',
        type: 'module',
        suppressWarnings: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@mui') || id.includes('@emotion') || id.includes('@fontsource')) {
            return 'vendor-mui';
          }

          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) {
            return 'vendor-react';
          }

          if (id.includes('mobx')) {
            return 'vendor-mobx';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    allowedHosts,
    proxy: {
      // Proxy API calls to the app service
      '/api': {
        target: devApiTarget,
        changeOrigin: true,
      },
      '/messagehub': {
        target: devApiTarget,
        changeOrigin: true,
        ws: true,
      },
    }
  }
}));
