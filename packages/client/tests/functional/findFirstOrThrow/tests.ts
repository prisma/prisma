import { faker } from '@faker-js/faker'
import { exec } from 'child_process'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const existingEmail = faker.internet.email()
const nonExistingEmail = faker.internet.email()

testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  beforeAll(async () => {
    await prisma.user.create({ data: { email: existingEmail, posts: { create: { title: 'How to exist?' } } } })
  })

  test('finds existing record', async () => {
    const record = await prisma.user.findFirstOrThrow({ where: { email: existingEmail } })
    expect(record).toMatchObject({ id: expect.any(String), email: existingEmail })
    expectTypeOf(record).not.toBeNullable()
  })

  test('works with fluent api', async () => {
    const posts = await prisma.user.findFirstOrThrow({ where: { email: existingEmail } }).posts()
    expect(posts).toMatchInlineSnapshot(
      [{ id: expect.any(String), authorId: expect.any(String) }],
      `
      Array [
        Object {
          authorId: Any<String>,
          id: Any<String>,
          title: How to exist?,
        },
      ]
    `,
    )
  })

  test('throws if record was not found', async () => {
    const record = prisma.user.findFirstOrThrow({ where: { email: nonExistingEmail } })
    await expect(record).rejects.toThrowErrorMatchingInlineSnapshot(`No user found`)
  })

  // TODO: it actually does not work this way, but neither does `rejectOnNotFound`.
  // unclear, if intentional
  test.skip('works with transactions', async () => {
    const newEmail = faker.internet.email()
    const result = prisma.$transaction([
      prisma.user.create({ data: { email: newEmail } }),
      prisma.user.findFirst({ where: { email: nonExistingEmail }, rejectOnNotFound: true }),
    ])

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`No User found`)

    const record = await prisma.user.findFirst({ where: { email: newEmail } })
    expect(record).toBeNull()
  })

  test('works with interactive transactions', async () => {
    const newEmail = faker.internet.email()
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({ data: { email: newEmail } })
      await prisma.user.findFirstOrThrow({ where: { email: nonExistingEmail } })
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`No user found`)

    const record = await prisma.user.findFirst({ where: { email: newEmail } })
    expect(record).toBeNull()
  })

  test('reports correct method name in case of validation error', async () => {
    const record = prisma.user.findFirstOrThrow({
      where: {
        // @ts-expect-error triggering validation error on purpose
        notAUserField: true,
      },
    })
    await expect(record).rejects.toMatchObject({
      message: expect.stringContaining('Invalid `prisma.user.findFirstOrThrow()` invocation'),
    })
  })

  test('does not accept rejectOnNotFound option', async () => {
    const record = prisma.user.findFirstOrThrow({
      where: { email: existingEmail },
      // @ts-expect-error passing not supported option on purpose
      rejectOnNotFound: false,
    })

    await expect(record).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma.user.findFirstOrThrow()\` invocation in
            /client/tests/functional/findFirstOrThrow/tests.ts:86:32

               83 })
               84 
               85 test('does not accept rejectOnNotFound option', async () => {
            →  86   const record = prisma.user.findFirstOrThrow(
            'rejectOnNotFound' option is not supported
          `)
  })
})
