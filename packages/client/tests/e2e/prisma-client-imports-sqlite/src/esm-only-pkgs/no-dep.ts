import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

import { PrismaClient } from '../../custom'

const libsqlClient = createClient({
  url: 'libsql://test-prisma.turso.io',
  authToken: '',
})
export const libsqlPrismaClient = new PrismaClient({
  adapter: new PrismaLibSQL(libsqlClient),
})
void libsqlPrismaClient.user.findMany()
