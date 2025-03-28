import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  studio: {
    adapter: async () => {
      const { mockMigrationAwareAdapterFactory } = await import('test-utils/mock-adapter')
      return mockMigrationAwareAdapterFactory('postgres')
    },
  },
})
