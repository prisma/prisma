import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  earlyAccess: true,
  tables: {
    external: ['table1', 'specific_schema.table2'],
  },
} satisfies PrismaConfig
