import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { bindAdapter } from '@prisma/driver-adapter-utils'
import { IntMode, createClient } from '@libsql/client'
import { describe } from 'node:test'
import { smokeTestLibquery } from './libquery'

describe('libsql', async () => {
  const url = process.env.JS_LIBSQL_DATABASE_URL as string
  const syncUrl = process.env.JS_LIBSQL_SYNC_URL
  const authToken = process.env.JS_LIBSQL_AUTH_TOKEN
  const intMode = process.env.JS_LIBSQL_INT_MODE as IntMode | undefined

  const client = createClient({ url, syncUrl, authToken, intMode })
  const adapter = new PrismaLibSQL(client)
  const driverAdapter = bindAdapter(adapter)

  if (syncUrl) {
    await client.sync()
  }

  smokeTestLibquery(driverAdapter, '../../prisma/sqlite/schema.prisma')
})
