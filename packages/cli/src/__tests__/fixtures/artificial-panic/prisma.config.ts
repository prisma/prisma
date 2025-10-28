import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'postgres://user:password@randomhost:5432',
  },
})
