import { defineConfig } from 'vitest/config'

const isCi = Boolean(process.env.CI)

export default defineConfig({
  resolve: {
    alias: {
      'src/*': './src/*',
      'test-utils/*': './src/__tests__/_utils/*',
    },
  },
  test: {
    include: ['**/*.test.ts'],
    globals: true,
    unstubEnvs: true,
    setupFiles: ['./vitest.setup.ts'],
    snapshotSerializers: ['@prisma/get-platform/src/test-utils/jestSnapshotSerializer'],
    coverage: {
      enabled: isCi,
      provider: 'v8',
      reportsDirectory: 'src/__tests__/coverage',
      reporter: ['clover'],
      include: ['src/**/*.ts'],
      exclude: ['**/__tests__/**/*', 'src/**/*.test.ts'],
    },
  },
})
