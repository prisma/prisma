import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'file:dev.db',
  },
  schema: './prisma/schema',
})
