import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.TEST_MYSQL_ISOLATED_URI,
  },
})
