import { defineConfig } from '@prisma/config'

export default defineConfig({
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['User'],
  },
  migrations: {
    setupExternalTables: `CREATE TABLE "User" ("id" SERIAL PRIMARY KEY, "name" TEXT NOT NULL);`,
  },
})
