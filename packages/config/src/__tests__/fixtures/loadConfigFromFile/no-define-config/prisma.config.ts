import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareDriverFactory } from 'test-utils/mock-adapter'

export default {
  experimental: {
    driver: true,
    studio: true,
  },
  schema: 'schema.prisma',
  driver: async () => {
    return mockMigrationAwareDriverFactory('postgres')
  },
  studio: {
    driver: async () => {
      return mockMigrationAwareDriverFactory('postgres')
    },
  },
} satisfies PrismaConfig
