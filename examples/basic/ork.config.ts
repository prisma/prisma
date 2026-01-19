import { defineConfig } from '@ork-orm/config'

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  generator: {
    provider: 'ork',
    output: './.ork',
  },
})
