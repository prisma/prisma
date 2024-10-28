import { PrismaClient } from '.prisma/client'

module '.prisma/client' {
  interface PrismaClient {
    $prepare: <T extends PrismaPromise<infer Result, infer Spec>>(
      prismaOp: T,
    ) => Promise<(params: Record<string, unknown>) => Promise<Result>>
    $debugQueryPlan: <T extends PrismaPromise<any>>(prismaOp: T) => Promise<string>
  }
}
