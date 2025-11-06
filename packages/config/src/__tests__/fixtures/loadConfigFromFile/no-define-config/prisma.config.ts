import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  experimental: {
    studio: true,
  },
  datasource: {
    url: 'postgresql://DATABASE_URL',
  },
  schema: 'schema.prisma',
  studio: {
    adapter: async () => {
      return mockMigrationAwareAdapterFactory('postgres')
    },
  },
} satisfies PrismaConfig
