import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema',
  datasource: {
    url: `file:./prisma/dev.db`,
  },
})
