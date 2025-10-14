import { defineConfig } from 'src/index'

export default defineConfig({
  experimental: {
    studio: true,
  },
  studio: {
    driver: async () => {
      const { mockMigrationAwareDriverFactory } = await import('test-utils/mock-adapter')
      return mockMigrationAwareDriverFactory('postgres')
    },
  },
})
