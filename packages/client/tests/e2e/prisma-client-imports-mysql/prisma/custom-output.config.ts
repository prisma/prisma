import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'custom-output.prisma',
  datasource: {
    url: 'mysql://prisma:prisma@localhost:3306/prisma',
  },
})
