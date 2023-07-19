import { PrismaClient } from '@prisma/client'
import accelerate from '@prisma/extension-accelerate'
import { expectTypeOf } from 'expect-type'

async function main() {
  const prisma = new PrismaClient().$extends(accelerate)

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
