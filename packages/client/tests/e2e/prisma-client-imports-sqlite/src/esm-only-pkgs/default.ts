import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/driver-libsql'

export const libsqlPrismaClient = new PrismaClient({
  driver: new PrismaLibSql({
    url: 'libsql://test-prisma.turso.io',
    authToken: '',
  }),
})
void libsqlPrismaClient.user.findMany()
