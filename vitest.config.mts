import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['providers/*', 'examples/*', 'core'],
    reporters: ['default', 'verbose', 'github-actions'],

  },
})
