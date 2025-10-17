import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('TEST_COCKROACH_URI_MIGRATE'),
  },
})
