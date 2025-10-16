import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('SOMETHING_UNDEFINED'),
  },
})
