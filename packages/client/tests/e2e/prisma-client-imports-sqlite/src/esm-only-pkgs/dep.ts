import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from 'db'

export const libsqlPrismaClient = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: 'libsql://test-prisma.turso.io',
    authToken: '',
  }),
})
void libsqlPrismaClient.user.findMany()
