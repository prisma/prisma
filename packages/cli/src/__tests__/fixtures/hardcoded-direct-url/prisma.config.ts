import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'postgresql://xyz:xyz@localhost:5432/xyz',
  },
})
