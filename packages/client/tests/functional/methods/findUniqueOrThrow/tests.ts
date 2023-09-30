import { copycat } from '@snaplet/copycat'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const existingEmail = copycat.email(71)
const nonExistingEmail = copycat.email(80)

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta, clientMeta) => {
  beforeAll(async () => {
    await prisma.user.create({ data: { email: existingEmail, posts: { create: { title: 'How to exist?' } } } })
  })

  test('finds existing record', async () => {
    const record = await prisma.user.findUniqueOrThrow({ where: { email: existingEmail } })
    expect(record).toMatchObject({ id: expect.any(String), email: existingEmail })
    expectTypeOf(record).not.toBeNullable()
  })

  test('throws if record was not found', async () => {
    const record = prisma.user.findUniqueOrThrow({ where: { email: nonExistingEmail } })
    await expect(record).rejects.toMatchObject(new Prisma.NotFoundError('No User found', '0.0.0'))
  })

  testIf(clientMeta.runtime !== 'edge')('works with transactions', async () => {
    const newEmail = copycat.email(90)
    const result = prisma.$transaction([
      prisma.user.create({ data: { email: newEmail } }),
      prisma.user.findUniqueOrThrow({ where: { email: nonExistingEmail } }),
    ])

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`No User found`)

    const record = await prisma.user.findUnique({ where: { email: newEmail } })
    expect(record).toBeNull()
  })

  testIf(clientMeta.runtime !== 'edge')('works with interactive transactions', async () => {
    const newEmail = copycat.email(99)
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({ data: { email: newEmail } })
      await prisma.user.findUniqueOrThrow({ where: { email: nonExistingEmail } })
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`No User found`)

    const record = await prisma.user.findUnique({ where: { email: newEmail } })
    expect(record).toBeNull()
  })

  test('reports correct method name in case of validation error', async () => {
    const record = prisma.user.findUniqueOrThrow({
      where: {
        // @ts-expect-error triggering validation error on purpose
        notAUserField: true,
      },
    })
    await expect(record).rejects.toMatchObject({
      message: expect.stringContaining('Invalid `prisma.user.findUniqueOrThrow()` invocation'),
    })
  })
})
