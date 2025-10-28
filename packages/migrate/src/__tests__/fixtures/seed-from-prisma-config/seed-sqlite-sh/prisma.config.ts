import { defineConfig } from '@prisma/config'
export default defineConfig({
  datasource: {
    url: 'file:./dev.db',
  },
  engine: 'classic',
  earlyAccess: true,
  migrations: {
    seed: './prisma/seed.sh',
  },
})
