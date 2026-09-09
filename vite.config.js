import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 750, rollupOptions: {
    output: { manualChunks: { three: ['three'], react: ['react','react-dom/client'] } }
  } },
  worker: { format: 'es' },
  server: { fs: { strict: true } }
});
