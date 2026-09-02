import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  optimizeDeps: {
    exclude: ['@kohaku-eth/pq-stealth-scheme3'],
  },
  assetsInclude: ['**/*.wasm'],
});
