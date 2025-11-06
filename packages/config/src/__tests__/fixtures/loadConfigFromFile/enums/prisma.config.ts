import type { PrismaConfig } from 'src/index'

export default {
  datasource: {
    url: 'postgresql://DATABASE_URL',
  },
  experimental: {
    externalTables: true,
  },
  enums: {
    external: ['some_enum'],
  },
} satisfies PrismaConfig
