import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

const existingEmail = faker.internet.email()
const nonExistingEmail = faker.internet.email()

testMatrix.setupTestSuite((_suiteConfig, _suiteMeta, clientMeta) => {
  beforeAll(async () => {
    console.log("findfirstOrThrow beforeAll")
    await prisma.user.create({ data: { email: existingEmail, posts: { create: { title: 'How to exist?' } } } })
  })

  test('finds existing record', async () => {
    const record = await prisma.user.findFirstOrThrow({ where: { email: existingEmail } })
    expect(record).toMatchObject({ id: expect.any(String), email: existingEmail })
    expectTypeOf(record).not.toBeNullable()
  })
})
