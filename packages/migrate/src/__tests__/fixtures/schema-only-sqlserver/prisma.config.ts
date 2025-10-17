import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('TEST_MSSQL_JDBC_URI_MIGRATE'),
  },
})
