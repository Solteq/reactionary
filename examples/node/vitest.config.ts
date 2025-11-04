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
    include: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.test.{ts,js}'],
    coverage: {
      reporter: [],
    },
    reporters: ['default', 'verbose'],
  },
});
