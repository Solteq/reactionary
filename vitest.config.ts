import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['capabilities/*', 'examples/*'],
    reporters: ['default', 'verbose', 'github-actions'],

  },
})
