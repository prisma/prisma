import { defineConfig } from 'prisma/config'
export default defineConfig({
  datasource: {
    url: 'file:./db',
  },
  engine: 'classic',
  schema: './prisma/schema.prisma',
})
