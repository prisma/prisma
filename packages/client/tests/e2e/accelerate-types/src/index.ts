import { withAccelerate } from '@prisma/extension-accelerate'
import { expectTypeOf } from 'expect-type'

import { PrismaClient } from './generated/prisma/client'

async function main() {
  const prisma = new PrismaClient().$extends(withAccelerate())

  const user = await prisma.user.findFirst({
    select: {
      id: true,
    },
  })

  expectTypeOf(user).toEqualTypeOf<{ id: number } | null>()

  await prisma.user.findFirst({
    select: {
      // @ts-expect-error
      wrong: true,
    },
  })
}

void main()
