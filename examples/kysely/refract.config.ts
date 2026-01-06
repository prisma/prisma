import { defineConfig } from '@refract/config'

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  generator: {
    provider: 'refract',
    output: './.refract',
  },
})
