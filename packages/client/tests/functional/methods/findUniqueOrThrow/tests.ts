import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

const existingEmail = faker.internet.email()
const nonExistingEmail = faker.internet.email()

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
    await expect(record).rejects.toMatchObject({
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
    })
  })

  testIf(clientMeta.runtime !== 'edge')('works with transactions', async () => {
    const newEmail = faker.internet.email()
    const result = prisma.$transaction([
      prisma.user.create({ data: { email: newEmail } }),
      prisma.user.findUniqueOrThrow({ where: { email: nonExistingEmail } }),
    ])

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.user.findUniqueOrThrow()\` invocation in
      /client/tests/functional/methods/findUniqueOrThrow/tests.ts:0:0

        33 const newEmail = faker.internet.email()
        34 const result = prisma.$transaction([
        35   prisma.user.create({ data: { email: newEmail } }),
      → 36   prisma.user.findUniqueOrThrow(
      An operation failed because it depends on one or more records that were required but not found. Expected a record, found none.
    `)

    const record = await prisma.user.findUnique({ where: { email: newEmail } })
    expect(record).toBeNull()
  })

  testIf(clientMeta.runtime !== 'edge')('works with interactive transactions', async () => {
    const newEmail = faker.internet.email()
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({ data: { email: newEmail } })
      await prisma.user.findUniqueOrThrow({ where: { email: nonExistingEmail } })
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.user.findUniqueOrThrow()\` invocation in
      /client/tests/functional/methods/findUniqueOrThrow/tests.ts:0:0

        56 const newEmail = faker.internet.email()
        57 const result = prisma.$transaction(async (prisma) => {
        58   await prisma.user.create({ data: { email: newEmail } })
      → 59   await prisma.user.findUniqueOrThrow(
      An operation failed because it depends on one or more records that were required but not found. Expected a record, found none.
    `)

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
