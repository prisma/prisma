import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'src/*': './src/*',
      'test-utils/*': './src/__tests__/_utils/*',
    },
  },
  test: {
    include: ['**/*.test.ts'],
    unstubEnvs: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
