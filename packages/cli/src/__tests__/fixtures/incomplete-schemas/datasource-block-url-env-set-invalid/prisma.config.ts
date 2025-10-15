import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.SOME_DEFINED_INVALID_URL,
  },
})
