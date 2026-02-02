import { defineConfig } from 'vite';

export default defineConfig({
  base: '/defchrtool/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'ES2020',
    outDir: 'dist'
  }
});
