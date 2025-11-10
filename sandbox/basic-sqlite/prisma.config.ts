import { defineConfig } from '@prisma/config'

export default defineConfig({
  engines: 'classic',
  datasource: {
    uri: 'file:dev.db',
  },
})