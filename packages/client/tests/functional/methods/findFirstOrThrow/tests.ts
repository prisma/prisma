import { faker } from '@faker-js/faker'
import { expectTypeOf } from 'expect-type'

import { AdapterProviders } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

const existingEmail = faker.internet.email()
const nonExistingEmail = faker.internet.email()

testMatrix.setupTestSuite(
  (_suiteConfig, _suiteMeta, clientMeta) => {
    beforeAll(async () => {
      await prisma.user.create({ data: { email: existingEmail, posts: { create: { title: 'How to exist?' } } } })
    })

    test('finds existing record', async () => {
      const record = await prisma.user.findFirstOrThrow({ where: { email: existingEmail } })
      expect(record).toMatchObject({ id: expect.any(String), email: existingEmail })
      expectTypeOf(record).not.toBeNullable()
    })

    test('throws if record was not found', async () => {
      const record = prisma.user.findFirstOrThrow({ where: { email: nonExistingEmail } })

      await expect(record).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
      })
    })

    // batch transaction needs to be implemented. Unskip once https://github.com/prisma/team-orm/issues/997 is done
    skipTestIf(clientMeta.runtime === 'edge' || _suiteConfig.driverAdapter === 'js_d1')(
      'works with transactions',
      async () => {
        const newEmail = faker.internet.email()
        const result = prisma.$transaction([
          prisma.user.create({ data: { email: newEmail } }),
          prisma.user.findFirstOrThrow({ where: { email: nonExistingEmail } }),
        ])

        await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "
        Invalid \`prisma.user.findFirstOrThrow()\` invocation in
        /client/tests/functional/methods/findFirstOrThrow/tests.ts:0:0

          39 const newEmail = faker.internet.email()
          40 const result = prisma.$transaction([
          41   prisma.user.create({ data: { email: newEmail } }),
        → 42   prisma.user.findFirstOrThrow(
        An operation failed because it depends on one or more records that were required but not found. Expected a record, found none."
      `)

        const record = await prisma.user.findFirst({ where: { email: newEmail } })
        expect(record).toBeNull()
      },
    )

    skipTestIf(clientMeta.runtime === 'edge' || _suiteConfig.driverAdapter === 'js_d1')(
      'works with interactive transactions',
      async () => {
        const newEmail = faker.internet.email()
        const result = prisma.$transaction(async (prisma) => {
          await prisma.user.create({ data: { email: newEmail } })
          await prisma.user.findFirstOrThrow({ where: { email: nonExistingEmail } })
        })

        await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
        "
        Invalid \`prisma.user.findFirstOrThrow()\` invocation in
        /client/tests/functional/methods/findFirstOrThrow/tests.ts:0:0

          65 const newEmail = faker.internet.email()
          66 const result = prisma.$transaction(async (prisma) => {
          67   await prisma.user.create({ data: { email: newEmail } })
        → 68   await prisma.user.findFirstOrThrow(
        An operation failed because it depends on one or more records that were required but not found. Expected a record, found none."
      `)

        const record = await prisma.user.findFirst({ where: { email: newEmail } })
        expect(record).toBeNull()
      },
    )

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
  },
  {
    skipDriverAdapter: {
      from: [AdapterProviders.JS_LIBSQL],
      reason: 'js_libsql: SIGABRT due to panic in libsql (not yet implemented: array)', // TODO: ORM-867
    },
  },
)
