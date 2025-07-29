import { defineConfig } from '@prisma/config'

export default defineConfig({
  earlyAccess: true,
  migrations: {
    seed: 'node --loader ts-node/esm prisma/seed.ts',
  },
})
