import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    fs: {
      strict: true,
      deny: ['**/.env', '**/.env.*', '**/.git/**', '**/server/config/**', '**/server/private/**', '**/users.json', '**/*service-account*.json', '**/*credential*.json', '**/*secret*.json', '**/cache/**', '**/sessions/**'],
    },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: 'dist' },
});
