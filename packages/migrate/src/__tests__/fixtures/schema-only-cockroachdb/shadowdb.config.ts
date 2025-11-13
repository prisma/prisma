import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: env('TEST_COCKROACH_URI_MIGRATE'),
    shadowDatabaseUrl: env('TEST_COCKROACH_SHADOWDB_URI_MIGRATE'),
  },
  schema: './prisma/shadowdb.prisma',
})
