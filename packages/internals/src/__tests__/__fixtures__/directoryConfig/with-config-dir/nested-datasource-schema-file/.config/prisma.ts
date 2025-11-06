import { defineConfig } from '@prisma/config'

export default defineConfig({
  schema: '../prisma/datasource',
  datasource: {
    url: 'file:./dev.db',
  },
})
