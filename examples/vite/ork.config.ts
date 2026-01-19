import type { OrkConfig } from '@ork-orm/config'

export default {
  schema: './schema.prisma',
  datasource: {
    provider: 'sqlite',
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
  generator: {
    provider: 'ork',
    output: './.ork',
  },
} satisfies OrkConfig
