import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'file:prisma/dev.db',
  },
  schema: './prisma/schema',
})
