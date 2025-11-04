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
      provider: 'v8',
      reporter: ['html'],
      reportsDirectory: '../../coverage/providers/medusa',
    },
    reporters: ['default', 'verbose', 'github-actions'],
  },
});
