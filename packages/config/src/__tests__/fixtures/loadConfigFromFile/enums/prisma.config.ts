import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  experimental: {
    externalTables: true,
  },
  enums: {
    external: ['some_enum'],
  },
} satisfies PrismaConfig
