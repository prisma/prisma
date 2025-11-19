import { defineConfig, env } from 'prisma/config'
import type { PrismaConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
}) satisfies PrismaConfig
