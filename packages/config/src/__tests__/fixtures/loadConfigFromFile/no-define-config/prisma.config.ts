import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  experimental: {
    adapter: true,
    studio: true,
  },
  schema: 'schema.prisma',
  studio: {
    adapter: async () => {
      return mockMigrationAwareAdapterFactory('postgres')
    },
  },
} satisfies PrismaConfig
