import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'postgres://prisma:prisma@localhost:5444/tests)',
  },
})
