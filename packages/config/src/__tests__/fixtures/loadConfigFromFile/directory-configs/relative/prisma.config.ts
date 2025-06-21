import { defineConfig } from 'src/index'

export default defineConfig({
  earlyAccess: true,
  viewsDirectory: './custom/views',
  typedSqlDirectory: './custom/sql',
  migrate: {
    migrationsDirectory: './custom/migrations',
  },
})
