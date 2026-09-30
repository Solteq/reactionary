import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/mcp',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'mcp',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/mcp',
      provider: 'v8' as const,
    },
  },
}));
