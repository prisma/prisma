import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})