import { defineConfig } from '@prisma/config'
export default defineConfig({
  datasource: {
    url: process.env.TEST_POSTGRES_URI_MIGRATE,
  },
  engine: 'classic',
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['public.User'],
  },
  migrations: {
    initShadowDb: `CREATE TABLE "User" ("id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL);`,
  },
})
