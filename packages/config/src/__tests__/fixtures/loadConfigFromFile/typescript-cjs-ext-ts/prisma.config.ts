import { defineConfig } from 'src/index'
import { mockAdapter } from 'test-utils/mock-adapter'

export default defineConfig({
  experimental: true,
  studio: {
    adapter: async () => {
      return mockAdapter('postgres')
    },
  },
})
