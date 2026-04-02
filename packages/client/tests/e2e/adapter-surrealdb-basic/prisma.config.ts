import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: process.env.SURREALDB_URL ?? 'surrealdb://root:root@localhost:8000/test/e2e',
  },
})
