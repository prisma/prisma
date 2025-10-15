import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.TEST_E2E_POSTGRES_URI,
  },
})
