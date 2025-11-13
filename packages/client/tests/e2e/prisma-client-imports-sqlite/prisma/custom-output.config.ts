import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './custom-output.prisma',
  datasource: {
    url: `file:./db`,
  },
})
