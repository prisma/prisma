import { PrismaLibSql } from '@prisma/driver-libsql'

import { PrismaClient } from '../../custom'

export const libsqlPrismaClient = new PrismaClient({
  driver: new PrismaLibSql({
    url: 'libsql://test-prisma.turso.io',
    authToken: '',
  }),
})
void libsqlPrismaClient.user.findMany()
