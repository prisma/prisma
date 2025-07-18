import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  tables: {
    external: ['User'],
  },
})
