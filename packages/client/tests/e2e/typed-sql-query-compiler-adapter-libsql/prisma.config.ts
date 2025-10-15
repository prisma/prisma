import { defineConfig } from 'prisma/config'
export default defineConfig({
  datasource: {
    url: 'file:./dev.db',
  },
  engine: 'classic',
  schema: './prisma/schema.prisma',
  typedSql: {
    path: './prisma/sql',
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
})
