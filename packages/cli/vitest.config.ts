import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Coverage configuration for better test quality insights
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.d.ts', '**/*.config.*', '**/test-temp/**'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Timeout configuration for CLI operations that might take longer
    testTimeout: 10000,
    hookTimeout: 10000,
    // Better test isolation
    isolate: true,
    // Use forks pool for CLI tests that need process.chdir()
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // CLI tests often involve file system operations and process.chdir()
      },
    },
    // Setup files for common test utilities
    setupFiles: [],
    // File patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/test-temp/**',
    ],
    // Reporter configuration
    reporters: ['verbose'],
    // Retry flaky tests (useful for CLI tests that interact with file system)
    retry: 1,
  },
})
