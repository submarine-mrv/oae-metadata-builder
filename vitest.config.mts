import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    env: {
      VITEST: 'true'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'src/utils/**/*.{ts,tsx}',
        'src/app/**/*.{ts,tsx}',
        'src/contexts/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'scripts/**/*.mjs'
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/components/rjsf/**', // Skip RJSF custom widgets (mostly UI)
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
