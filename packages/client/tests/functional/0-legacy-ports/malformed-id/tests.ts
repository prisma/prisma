import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type $ from './generated/prisma/client'

declare let prisma: $.PrismaClient

// ported from: blog
testMatrix.setupTestSuite(
  () => {
    test('should throw Malformed ObjectID error: in 2 different fields', async () => {
      const user = prisma.user.create({
        data: {
          id: 'something invalid 1', // first
          ids: ['something invalid 2'], // second
          name: 'Jane Doe',
        },
      })

      // Message doesn't know if one or more values failed, which one failed,
      // errors on the first https://github.com/prisma/prisma/issues/11885
      await expect(user).rejects.toMatchPrismaErrorInlineSnapshot(`
        "
        Invalid \`prisma.user.create()\` invocation in
        /client/tests/functional/0-legacy-ports/malformed-id/tests.ts:0:0

           XX testMatrix.setupTestSuite(
          XX   () => {
          XX     test('should throw Malformed ObjectID error: in 2 different fields', async () => {
        → XX       const user = prisma.user.create(
        Inconsistent column data: Malformed ObjectID: provided hex string representation must be exactly 12 bytes, instead got: "something invalid 1", length 19 for the field 'id'."
      `)
    })

    test('should throw Malformed ObjectID error for: _id', async () => {
      const user = prisma.user.create({
        data: {
          ids: ['something invalid'],
          name: 'Jane Doe',
        },
      })

      await expect(user).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect.objectContaining({
          message: expect.stringContaining('Malformed ObjectID'),
        }),
      )
    })

    test('should throw Malformed ObjectID error for: ids String[] @db.ObjectId', async () => {
      const user = prisma.user.create({
        data: {
          id: 'something invalid',
          name: 'Jane Doe',
        },
      })

      await expect(user).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect.objectContaining({
          message: expect.stringContaining('Malformed ObjectID'),
        }),
      )
    })
  },
  {
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason: 'Currently, only MongoDB strictly validates the id fields.',
    },
  },
)
