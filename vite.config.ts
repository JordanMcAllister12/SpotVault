import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const BUILD_TIMESTAMP = new Date().toISOString().slice(0, 16).replace('T', ' ');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(`build-${BUILD_TIMESTAMP}`),
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
