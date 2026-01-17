import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      '!packages/cli',
      '!packages/client',
      '!packages/client-engine-runtime',
      '!packages/config',
      '!packages/debug',
      '!packages/get-platform',
      '!packages/integration-tests',
      '!packages/internals',
      '!packages/migrate',
    ],
  },
})
