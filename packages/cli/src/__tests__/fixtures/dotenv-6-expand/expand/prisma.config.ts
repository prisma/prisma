import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.DOTENV_PRISMA_EXPAND_DATABASE_URL_WITH_SCHEMA,
  },
})
