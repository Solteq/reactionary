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
      provider: 'v8',
      reporter: ['html'],
      reportsDirectory: '../../coverage/providers/fake',
    },
    reporters: ['default', 'verbose', 'github-actions'],
  },
});
