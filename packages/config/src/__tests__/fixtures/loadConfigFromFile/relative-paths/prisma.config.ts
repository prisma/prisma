import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  schema: './custom/schema.prisma',
  views: {
    path: './custom/views',
  },
  typedSql: {
    path: './custom/typedSql',
  },
  migrations: {
    path: './custom/migrations',
  },
})
