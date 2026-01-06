import type { RefractConfig } from '@refract/config'

export default {
  schema: './schema.prisma',
  datasource: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
  generator: {
    provider: 'refract',
    output: './.refract',
  },
} satisfies RefractConfig
