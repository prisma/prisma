import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    exclude: ['**/node_modules/**', '**/__helpers__/**'],
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
