import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: env('TEST_MYSQL_URI_MIGRATE'),
    shadowDatabaseUrl: env('TEST_MYSQL_SHADOWDB_URI_MIGRATE'),
  },
  schema: './prisma/shadowdb.prisma',
})
