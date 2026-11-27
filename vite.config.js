import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: { chunkSizeWarningLimit: 600 },
  test: {
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.js', 'src/**/*.{js,jsx}'],
      exclude: ['server/index.js', 'src/main.jsx'],
      reporter: ['text-summary', 'text'],
    },
    projects: [
      {
        extends: true,
        test: { name: 'server', environment: 'node', include: ['tests/server/**/*.test.js'] },
      },
      {
        extends: true,
        test: { name: 'repo', environment: 'node', include: ['tests/repo/**/*.test.js'] },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['tests/client/**/*.test.{js,jsx}'],
        },
      },
    ],
  },
});
