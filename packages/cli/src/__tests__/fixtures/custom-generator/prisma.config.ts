import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.ENV_VAR_DOES_NOT_EXIST,
  },
})
