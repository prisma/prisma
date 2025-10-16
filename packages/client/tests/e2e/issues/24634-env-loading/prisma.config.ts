import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('LOCAL_DATABASE_URL'),
  },
})
