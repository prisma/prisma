import type { PrismaConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default {
  experimental: {
    adapter: true,
  },
  engine: 'js',
  adapter: async () => {
    return mockMigrationAwareAdapterFactory('postgres')
  },
} satisfies PrismaConfig
