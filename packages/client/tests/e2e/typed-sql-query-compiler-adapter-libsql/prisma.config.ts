import { defineConfig } from 'prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'file:./dev.db',
  },
  schema: './prisma/schema.prisma',
  typedSql: {
    path: './prisma/sql',
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
})
