import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    globals: true,
    snapshotSerializers: ['@prisma/get-platform/src/test-utils/jestSnapshotSerializer'],
  },
})
