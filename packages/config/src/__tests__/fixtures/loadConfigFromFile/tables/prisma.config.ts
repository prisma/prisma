import type { PrismaConfig } from 'src/index'

export default {
  datasource: {
    url: 'postgresql://DATABASE_URL',
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['table1', 'specific_schema.table2'],
  },
} satisfies PrismaConfig
