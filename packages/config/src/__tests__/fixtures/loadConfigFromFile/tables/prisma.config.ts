import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareDriverFactory } from 'test-utils/mock-adapter'

export default {
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['table1', 'specific_schema.table2'],
  },
} satisfies PrismaConfig
