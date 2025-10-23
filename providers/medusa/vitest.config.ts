/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/index.ts'],
    },
    reporters: ['default', 'verbose'],
  },
});
