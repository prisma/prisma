import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  studio: {
    adapter: async () => {
      const { mockAdapter } = await import('test-utils/mock-adapter')
      return mockAdapter('postgres')
    },
  },
})
