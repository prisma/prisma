import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'prisma://localhost:50000/?api_key=1',
  },
})
