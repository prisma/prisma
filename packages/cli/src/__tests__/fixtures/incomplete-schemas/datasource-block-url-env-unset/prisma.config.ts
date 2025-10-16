import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('SOME_UNDEFINED_DB'),
  },
})
