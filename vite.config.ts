import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    // Lúc phát triển, Vite chuyển các lời gọi API sang server Node ở 8787.
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.API_PORT ?? 8787}`, changeOrigin: false },
    },
  },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022' },
});
