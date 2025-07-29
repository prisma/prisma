import { defineConfig } from 'src/index'
import { mockMigrationAwareAdapterFactory } from 'test-utils/mock-adapter'

export default defineConfig({
  experimental: {
    studio: true,
  },
  studio: {
    adapter: async () => {
      return mockMigrationAwareAdapterFactory('postgres')
    },
  },
})
