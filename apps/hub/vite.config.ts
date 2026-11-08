import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    // Local D1 state lives at the repo root, so every app sees the same database, as in production.
    cloudflare({ persistState: { path: '../../.wrangler/state' } }),
    tailwindcss(),
  ],
  server: { port: 5173, strictPort: true },
});
