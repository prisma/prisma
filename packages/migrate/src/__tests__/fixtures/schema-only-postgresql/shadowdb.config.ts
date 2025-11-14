import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: env('TEST_POSTGRES_URI_MIGRATE'),
    shadowDatabaseUrl: env('TEST_POSTGRES_SHADOWDB_URI_MIGRATE'),
  },
  schema: './prisma/shadowdb.prisma',
})
