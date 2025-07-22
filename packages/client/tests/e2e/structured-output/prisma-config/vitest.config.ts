import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    snapshotSerializers: ['@prisma/get-platform/src/test-utils/jestSnapshotSerializer'],
  },
})
