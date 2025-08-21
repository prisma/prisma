import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  typedSql: {
    path: './prisma/sql',
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
})
