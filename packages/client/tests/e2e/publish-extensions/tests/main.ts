import { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client/extension'
import { simpleExtension } from 'simple-ext'

test('prisma versions', () => {
  expect(Prisma.prismaVersion.client).toMatch(/^\d+\.\d+\.\d+/)
  expect(Prisma.prismaVersion.engine).toMatch(/^[a-f0-9]{40}/)
})

test('simple extension', () => {
  const prisma = new PrismaClient().$extends(simpleExtension)

  prisma.user.simpleCall({
    where: {
      email: 'a',
      // @ts-expect-error
      nonExistentField: 2,
    },
  })
})
