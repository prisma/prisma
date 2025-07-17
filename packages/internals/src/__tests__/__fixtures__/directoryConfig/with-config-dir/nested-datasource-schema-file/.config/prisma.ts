import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: '../prisma/datasource'
})
