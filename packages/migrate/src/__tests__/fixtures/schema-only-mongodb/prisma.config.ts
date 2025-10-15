import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.TEST_MONGO_URI_MIGRATE,
  },
})
