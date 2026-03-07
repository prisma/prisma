import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    exclude: ['**/__helpers__/**'],
    globals: true,
    setupFiles: ['./helpers/jestSetup.js'],
    snapshotSerializers: ['@prisma/get-platform/src/test-utils/jestSnapshotSerializer'],
  },
})
