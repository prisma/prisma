import { defineConfig } from '@prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.TEST_POSTGRES_URI_MIGRATE,
  },
})
