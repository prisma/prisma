/* eslint-disable import/no-duplicates */
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from 'db'

const libsqlClient = createClient({
  url: '',
  authToken: '',
})
export const libsqlPrismaClient = new PrismaClient({
  adapter: new PrismaLibSQL(libsqlClient),
})
void libsqlPrismaClient.user.findMany()
