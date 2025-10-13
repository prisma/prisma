import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/demo/**', // Exclude demo tests (they have separate dependencies)
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
})
