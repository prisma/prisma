import path from 'node:path'
import { defineConfig } from '@prisma/config'

type Env = {
  DOTENV_PRISMA_STUDIO_LIBSQL_DATABASE_URL: 'string'
}

// Simulate env var loading
process.env.DOTENV_PRISMA_STUDIO_LIBSQL_DATABASE_URL = `file:${path.join(__dirname, 'dev_tmp.db')}`

export default defineConfig({
  earlyAccess: true,
  schema: {
    kind: 'single',
    filePath: path.join(__dirname, 'schema-c.prisma'),
  },
  studio: {
    adapter: async (env: Env) => {
      const { PrismaLibSQL } = await import('@prisma/adapter-libsql')
      const { createClient } = await import('@libsql/client')

      const libsql = createClient({
        url: env.DOTENV_PRISMA_STUDIO_LIBSQL_DATABASE_URL,
      })
      return new PrismaLibSQL(libsql)
    },
  },
})
