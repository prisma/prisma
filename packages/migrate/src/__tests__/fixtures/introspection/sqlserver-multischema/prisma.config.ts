import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.TEST_MSSQL_JDBC_URI_MIGRATE,
  },
})
