import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Jadeed Rifah Rehab ERP',
        short_name: 'Jadeed ERP',
        description: 'Rehab & Care Center Management System',
        theme_color: '#1B365D',
        background_color: '#F4F6F9',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'brand/jadeed-logo.png',
            sizes: '168x168',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
})
