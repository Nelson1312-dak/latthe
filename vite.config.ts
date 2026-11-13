import { defineConfig } from 'vite';

// Chế độ online: máy chủ nhỏ ở server/ (npm run server). Chỉ dev và preview cần proxy; bản
// triển khai thật đặt API cùng tên miền.
const api = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } };

export default defineConfig({
  server: { port: 5180, open: false, proxy: api },
  preview: { proxy: api },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
