import path from 'node:path'
import { defineConfig } from '@prisma/config'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

export default defineConfig({
  earlyAccess: true,
  schema: {
    kind: 'single',
    filePath: path.join(__dirname, 'schema-c.prisma'),
  },
  studio: {
    adapter: async (env: unknown) => {
      const connectionString = `file:${path.join(__dirname, './dev_tmp.db')}`
      const libsql = createClient({
        url: connectionString,
      })
      return new PrismaLibSQL(libsql)
    },
  },
})
