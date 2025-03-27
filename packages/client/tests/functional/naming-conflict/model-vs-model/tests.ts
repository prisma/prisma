import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  test('allows to use models of conflicting names', async () => {
    await prisma.model.create({
      data: {
        other: {
          create: { name: 'Other type' },
        },
      },
    })

    const value = await prisma.model.findFirstOrThrow({ include: { other: true } })

    expect(value.other).toMatchObject({ id: expect.any(String), name: 'Other type' })
    expectTypeOf(value.other).not.toBeAny()
    expectTypeOf(value.other).toMatchTypeOf<{ name: string; id: string }>()
  })
})
