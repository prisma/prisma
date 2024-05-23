import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    globals: true,
    include: ['**.itest.ts'],
    poolOptions: {
      workers: {
        isolatedStorage: true,
        wrangler: {
          configPath: './wrangler.toml',
        },
      },
    },
    // The lines below are equivalent to Jest's --runInBand
    // "Run all tests serially in the current process, rather than creating a worker pool of child processes that run tests."
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
})
