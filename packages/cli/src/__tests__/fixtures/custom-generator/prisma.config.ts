import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('ENV_VAR_DOES_NOT_EXIST'),
  },
})
