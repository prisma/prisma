import { defineConfig } from '@refract/config'

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/refract_basic',
  },
  generator: {
    provider: 'refract',
    output: './generated',
  },
})
