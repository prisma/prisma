import path from 'node:path'
import { defineConfig } from 'src/index'

export default defineConfig({
  schema: path.join('custom', 'schema.prisma'),
  views: {
    path: path.join('custom', 'views'),
  },
  typedSql: {
    path: path.join('custom', 'typedSql'),
  },
  migrations: {
    path: path.join('custom', 'migrations'),
  },
})
