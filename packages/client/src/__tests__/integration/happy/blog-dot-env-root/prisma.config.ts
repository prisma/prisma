import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('SQLITE_URL_FROM_DOT_ENV_FILE'),
  },
})
