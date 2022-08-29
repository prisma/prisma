import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore
declare let Prisma: typeof import('@prisma/client').Prisma

const existingEmail = faker.internet.email()
const nonExistingEmail = faker.internet.email()

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
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
    await expect(record).rejects.toThrowError(new Prisma.NotFoundError('No User found'))
  })

  // TODO: it actually does not work this way, but neither does `rejectOnNotFound`.
  // unclear, if intentional
  test.skip('works with transactions', async () => {
    const newEmail = faker.internet.email()
    const result = prisma.$transaction([
      prisma.user.create({ data: { email: newEmail } }),
      prisma.user.findUnique({ where: { email: nonExistingEmail }, rejectOnNotFound: true }),
    ])

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`No User found`)

    const record = await prisma.user.findUnique({ where: { email: newEmail } })
    expect(record).toBeNull()
  })

  test('works with interactive transactions', async () => {
    const newEmail = faker.internet.email()
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

  test('does not accept rejectOnNotFound option', async () => {
    const record = prisma.user.findUniqueOrThrow({
      where: { email: existingEmail },
      // @ts-expect-error passing not supported option on purpose
      rejectOnNotFound: false,
    })

    await expect(record).rejects.toThrowErrorMatchingInlineSnapshot(`

      Invalid \`prisma.user.findUniqueOrThrow()\` invocation in
      /client/tests/functional/methods/findUniqueOrThrow/tests.ts:71:32

        68 })
        69 
        70 test('does not accept rejectOnNotFound option', async () => {
      → 71   const record = prisma.user.findUniqueOrThrow(
      'rejectOnNotFound' option is not supported
    `)
  })
})
