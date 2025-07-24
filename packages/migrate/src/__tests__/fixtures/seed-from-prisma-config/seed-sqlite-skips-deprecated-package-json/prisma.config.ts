import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  migrations: {
    seed: 'node prisma/seed.js',
  },
})
