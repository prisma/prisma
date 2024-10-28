import { PrismaClient } from '.prisma/client'

module '.prisma/client' {
  interface PrismaClient {
    $prepare: <T extends PrismaPromise<any>>(prismaOp: T) => T
    $debugQueryPlan: <T extends PrismaPromise<any>>(prismaOp: T) => T
  }
}
