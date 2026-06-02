import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Standalone test config — deliberately NO @cloudflare/vite-plugin (that runs the worker in
// Miniflare and isn't needed for jsdom unit/component tests). Vitest prefers this over vite.config.ts.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
