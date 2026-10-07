import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The Univerus web components are a workspace package rebuilt by `stencil --watch` in dev:
  // never pre-bundle them, or Vite would keep serving a stale copy
  optimizeDeps: {
    exclude: ['@powerreact/univerus-elements'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
