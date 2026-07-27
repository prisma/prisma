import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

/**
 * PostgreSQL reports the offending column of a NOT NULL violation (23502) in
 * `error.column` rather than in the `Key (...)` detail used by unique violations,
 * so the rendered P2011 has to name the column instead of `(not available)`.
 *
 * `title` is nullable in the Prisma schema and made NOT NULL in the database
 * afterwards: were it required in the schema, client-side validation would reject
 * the write before any SQL reached the database.
 */
testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Article" ALTER COLUMN "title" SET NOT NULL`)
    })

    test('P2011 names the violating column, sourced from error.column', async () => {
      const result = prisma.article.create({ data: { title: null } })

      await expect(result).rejects.toMatchObject({
        name: 'PrismaClientKnownRequestError',
        code: 'P2011',
        message: expect.stringContaining('Null constraint violation on the fields: (`title`)'),
      })
    })
  },
  {
    optOut: {
      from: [Providers.MYSQL, Providers.SQLITE, Providers.SQLSERVER, Providers.MONGODB, Providers.COCKROACHDB],
      reason: 'Tests PostgreSQL-specific NOT NULL error mapping via error.column',
    },
    skip(when, { clientEngineExecutor }) {
      when(clientEngineExecutor === 'remote', 'Driver adapter error mapping is exercised through the local executor')
    },
  },
)
