import path from 'node:path'
import { defineConfig } from '@prisma/config'

type Env = {
  DOTENV_PRISMA_STUDIO_LIBSQL_DATABASE_URL: 'string'
}

const env = process.env as Env

// Simulate env var loading
process.env.DOTENV_PRISMA_STUDIO_LIBSQL_DATABASE_URL = `file:${path.join(__dirname, 'dev_tmp.db')}`

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'schema-c.prisma'),
  studio: {
    adapter: async () => {
      const { PrismaLibSQL } = await import('@prisma/adapter-libsql')

      return new PrismaLibSQL({
        url: env.DOTENV_PRISMA_STUDIO_LIBSQL_DATABASE_URL,
      })
    },
  },
})
