import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: ['components/ui/**', 'app/layout.tsx', '**/*.test.{ts,tsx}', 'vitest.setup.ts'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 80 },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
