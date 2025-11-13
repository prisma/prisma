import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'default-output.prisma',
  datasource: {
    url: 'mysql://prisma:prisma@localhost:3306/prisma',
  },
})
