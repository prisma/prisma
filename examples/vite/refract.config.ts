import type { RefractConfig } from '@refract/config'

export default {
  schema: './schema.prisma',
  datasource: {
    provider: 'sqlite',
    url: 'file:./dev.db',
  },
  generator: {
    provider: 'refract',
    output: './.refract',
  },
} satisfies RefractConfig
