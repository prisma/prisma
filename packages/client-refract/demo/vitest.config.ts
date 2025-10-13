import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds for container operations
    hookTimeout: 60000, // 60 seconds for setup/teardown
    pool: 'forks', // Use forks pool for better isolation with containers
    maxConcurrency: 1, // Run tests sequentially to avoid container conflicts
    environment: 'node',
  },
  resolve: {
    alias: {
      '@refract/client': path.resolve(__dirname, '../src/index.ts'),
    },
  },
})
