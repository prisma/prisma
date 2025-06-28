import path from 'node:path'
import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  viewsDirectory: path.join(process.cwd(), 'custom', 'views'),
  typedSqlDirectory: path.join(process.cwd(), 'custom', 'sql'),
  migrate: {
    migrationsDirectory: path.join(process.cwd(), 'custom', 'migrations'),
  },
})
