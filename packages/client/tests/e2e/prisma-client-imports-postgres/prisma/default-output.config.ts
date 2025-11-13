import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './default-output.prisma',
  datasource: {
    url: 'postgresql://prisma:prisma@localhost:5432/prisma',
  },
})
