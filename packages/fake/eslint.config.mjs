import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/esbuild.config.{js,ts,mjs,mts}',
          ],
          // pnpm "catalog:" specifiers (zod) are not resolved by this rule; faker is
          // reported against a stale installed version (9.9.0 vs. locked 10.6.0).
          ignoredDependencies: ['zod', '@faker-js/faker'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
