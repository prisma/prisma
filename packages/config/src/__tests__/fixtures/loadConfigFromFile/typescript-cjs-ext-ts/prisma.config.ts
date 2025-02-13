import { defineConfig } from 'src/index'
import { mockAdapter } from 'test-utils/mock-adapter'

export default defineConfig({
  earlyAccess: true,
  studio: {
    adapter: async () => {
      return mockAdapter('postgres')
    },
  },
})
