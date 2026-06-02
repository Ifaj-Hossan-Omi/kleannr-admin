import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// https://vite.dev/config/
export default defineConfig({
  // The cloudflare() plugin runs the BFF Worker (worker/index.ts) inside the dev
  // server with HMR, and bundles it for production. The Worker is now what the
  // browser talks to (/bff/*) and it proxies to the live API server-side — so the
  // old dev `server.proxy` is gone.
  plugins: [react(), cloudflare()],
  build: {
    // CSP: no inline module-preload polyfill (blocked by `script-src 'self'`).
    modulePreload: { polyfill: false },
  },
});
