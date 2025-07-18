import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  earlyAccess: true,
  migrations: {
    setupExternalTables: () => {
      return `
        CREATE TABLE "User" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL
        );
      `
    },
  },
} satisfies PrismaConfig
