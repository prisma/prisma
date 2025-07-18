import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  tables: {
    external: ['User'],
  },
  migrations: {
    setupExternalTables: async () => {
      return `
        CREATE TABLE "User" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );
      `
    },
  },
})
