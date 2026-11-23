import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/utils/**/*.ts',
        'src/services/**/*.ts',
        'src/hooks/**/*.ts',
        'src/server/**/*.ts',
        'api/**/*.ts',
      ],
      exclude: ['src/types/**', 'src/constants/**'],
    },
  },
});
