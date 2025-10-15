import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.TEST_COCKROACH_URI_MIGRATE,
  },
})
