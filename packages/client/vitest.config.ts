import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    exclude: ['**/node_modules/**', '**/__helpers__/**'],
    globals: true,
    setupFiles: ['./helpers/jestSetup.js'],
  },
})
