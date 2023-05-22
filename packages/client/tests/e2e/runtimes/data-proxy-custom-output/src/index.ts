import { expectTypeOf } from 'expect-type'

import { PrismaClient } from '../prisma/client'
import { PrismaClient as PrismaClientEdge } from '../prisma/client/edge'

// we only use this to test the types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function main() {
  const prisma = new PrismaClient()
  const prismaEdge = new PrismaClientEdge()

  const user = await prisma.user.create({
    data: { email: 'john@doe.io' },
  })

  const userEdge = await prismaEdge.user.create({
    data: { email: 'john@doe.io' },
  })

  expectTypeOf(user).toHaveProperty('email').not.toBeAny()
  expectTypeOf(userEdge).toHaveProperty('email').not.toBeAny()
}
