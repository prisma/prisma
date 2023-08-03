import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('is not null type inference', async () => {
    await prisma.user.create({
      data: {
        info: {
          create: {
            name: 'Jane Doe',
          },
        },
      },
    })

    const data = await prisma.user.findFirstOrThrow({
      where: { info: { isNot: null } },
      include: { info: true },
    })

    expect(data.info).not.toBeNull()
    expectTypeOf(data.info).not.toBeNullable()
  })
})
