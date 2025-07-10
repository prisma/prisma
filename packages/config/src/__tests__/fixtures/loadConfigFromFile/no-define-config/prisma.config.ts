import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  earlyAccess: true,
  schema: 'schema.prisma',
  adapter: async () => {
    return mockMigrationAwareAdapterFactory('postgres')
  },
  studio: {
    adapter: async () => {
      return mockMigrationAwareAdapterFactory('postgres')
    },
  },
} satisfies PrismaConfig
