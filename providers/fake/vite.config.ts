/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
});
