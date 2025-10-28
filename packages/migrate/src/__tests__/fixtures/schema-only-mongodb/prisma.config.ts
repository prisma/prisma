import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('TEST_MONGO_URI_MIGRATE'),
  },
})
