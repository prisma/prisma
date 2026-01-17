import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    watch: {
      // ignore generated files otherwise vitest will keep re-running tests in watch mode
      ignored: ['**/node_modules/**', '**/dist/**', '**/tests/generated/**'],
    },
  },
  test: {
    projects: [
      'packages/*',
      '!packages/cli',
      '!packages/client',
      '!packages/config',
      // '!packages/debug',
      // '!packages/get-platform',
      '!packages/integration-tests',
      '!packages/internals',
      '!packages/migrate',
    ],
  },
})
