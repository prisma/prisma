import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { IntMode, createClient } from '@libsql/client'
import { describe } from 'node:test'
import { smokeTestClient } from './client'

describe('libsql with @prisma/client', async () => {
  const url = process.env.JS_LIBSQL_DATABASE_URL as string
  const syncUrl = process.env.JS_LIBSQL_SYNC_URL
  const authToken = process.env.JS_LIBSQL_AUTH_TOKEN
  const intMode = process.env.JS_LIBSQL_INT_MODE as IntMode | undefined

  const client = createClient({ url, syncUrl, authToken, intMode })
  const adapter = new PrismaLibSQL(client)

  if (syncUrl) {
    await client.sync()
  }

  smokeTestClient(adapter)
})
