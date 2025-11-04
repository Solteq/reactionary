import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['providers/*', 'examples/*', 'core'],
    coverage: {
      provider: 'v8',
      reporter: ['html'],
      reportsDirectory: resolve(__dirname) + '/coverage/',
    },
    reporters: ['default', 'verbose', 'github-actions'],

  },
})
