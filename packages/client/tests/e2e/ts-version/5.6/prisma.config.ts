import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  engine: 'classic',
  datasource: {
    url: 'file:./db',
  },
})
