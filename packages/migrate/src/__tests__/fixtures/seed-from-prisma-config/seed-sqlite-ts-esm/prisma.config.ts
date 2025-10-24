import { defineConfig } from '@prisma/config'
export default defineConfig({
  datasource: {
    url: 'file:./dev.db',
  },
  engine: 'classic',
  earlyAccess: true,
  migrations: {
    seed: 'node --loader ts-node/esm prisma/seed.ts',
  },
})
