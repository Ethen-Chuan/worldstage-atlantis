import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5196, strictPort: true },
  preview: { host: '127.0.0.1', port: 5196, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/build/three.core.js')) return 'three-foundation';
          if (id.includes('/three/build/')) return 'three-renderer';
          if (id.includes('/three/examples/')) return 'three-effects';
        },
      },
    },
  },
});
