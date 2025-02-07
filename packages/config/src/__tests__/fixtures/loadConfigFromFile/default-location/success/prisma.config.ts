import { defineConfig } from 'src/index'

export default defineConfig({
  experimental: true,
  loadEnv: async () => {
    return {
      TEST_CONNECTION_STRING: 'postgresql://something'
    }
  },
})
