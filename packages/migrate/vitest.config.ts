import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    exclude: ['**/__helpers__/**'],
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    snapshotSerializers: ['@prisma/get-platform/src/test-utils/vitest-snapshot-serializer'],
  },
})
