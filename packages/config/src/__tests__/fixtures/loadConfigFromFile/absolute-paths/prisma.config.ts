import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'src/index'

const cwd = process.cwd()

export default defineConfig({
  schema: path.join(cwd, 'custom', 'schema.prisma'),
  views: {
    path: path.join(cwd, 'custom', 'views'),
  },
  typedSql: {
    path: path.join(cwd, 'custom', 'typedSql'),
  },
  migrations: {
    path: path.join(cwd, 'custom', 'migrations'),
  },
})
