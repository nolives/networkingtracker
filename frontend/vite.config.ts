import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // .env.local lives at the repository root so one file serves the frontend,
  // the backend, and the migration script. Without this, Vite would only look
  // inside frontend/ and every VITE_* variable would silently be undefined --
  // which makes the auth SDK fall back to a relative /api/auth path.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Local dev mirrors production, where the API is same-origin at /api.
    // The frontend therefore never needs an API base URL in either setting.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
