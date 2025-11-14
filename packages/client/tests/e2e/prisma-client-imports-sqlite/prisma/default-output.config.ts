import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './default-output.prisma',
  datasource: {
    url: `file:./db`,
  },
})
