import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'Calora', short_name: 'Calora', description: 'A gentle, AI-assisted calorie and wellness tracker.',
      theme_color: '#f6a95f', background_color: '#fff8ef', display: 'standalone', start_url: '/',
    },
    workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,svg,png,ico}'] },
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@calora/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
