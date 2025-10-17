import { mockAdapter } from 'test-utils/mock-adapter'

export default {
  experimental: {
    adapter: true,
  },
  engine: 'js',
  adapter: async () => {
    return mockAdapter('postgres')
  },
}
