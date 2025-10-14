import { defineConfig } from 'src/index'
import { mockMigrationAwareDriverFactory } from 'test-utils/mock-adapter'

export default defineConfig({
  experimental: {
    studio: true,
  },
  studio: {
    driver: async () => {
      return mockMigrationAwareDriverFactory('postgres')
    },
  },
})
