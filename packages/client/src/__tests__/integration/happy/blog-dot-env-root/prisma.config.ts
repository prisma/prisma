import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.SQLITE_URL_FROM_DOT_ENV_FILE,
  },
})
