/// <reference types="vitest" />
import { defineConfig, defineProject } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineProject({
  plugins: [nxViteTsPaths()],
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ds,ba,vv,ts}', 'src/**/*.test.{ts,js}'],
  },
});
