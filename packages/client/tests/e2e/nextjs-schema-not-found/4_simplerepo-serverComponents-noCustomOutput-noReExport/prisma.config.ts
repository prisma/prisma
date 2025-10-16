import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('TEST_E2E_POSTGRES_URI'),
  },
})
