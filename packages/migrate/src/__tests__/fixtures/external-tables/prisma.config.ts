import { defineConfig } from '@prisma/config/src'

export default defineConfig({
  earlyAccess: true,
  tables: {
    external: ['ExternalTable'],
  },
})
