import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow any host so the Vite dev server is reachable from the nginx
    // reverse proxy container as well as directly (localhost, VPS domain, IP).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_KATAGO_PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
