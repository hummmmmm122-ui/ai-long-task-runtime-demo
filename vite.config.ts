import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/ai-long-task-runtime-demo/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true
  }
});
