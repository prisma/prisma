import { Prisma, PrismaClient, Role } from '@prisma/client'

export default {
  fetch() {
    // When using Prisma Client in an edge runtime it would error like this:
    // ... is unable to run in an edge runtime. As an alternative, try Accelerate: https://pris.ly/d/accelerate.
    // But that should only happen when executing a query
    // This tests that creating an instance of PrismaClient does not error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _db = new PrismaClient()

    const data = {
      Role,
      ModelName: Prisma.ModelName,
    }

    return new Response(JSON.stringify(data))
  },
}
