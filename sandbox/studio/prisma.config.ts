import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url : process.env.DATABASE_URL!,
  },
  experimental: {},
  schema: './schema.prisma',
})
