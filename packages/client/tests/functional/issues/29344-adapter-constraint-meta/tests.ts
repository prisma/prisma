import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

// Regression test for https://github.com/prisma/prisma/issues/29344:
// constraint violation errors must carry the documented meta fields
// (`target` for P2002, `constraint` for P2003) and not only the raw
// `driverAdapterError`.
testMatrix.setupTestSuite(
  (suiteConfig) => {
    test('unique constraint violation (P2002) populates meta.target', async () => {
      await prisma.user.create({ data: { email: 'user@example.com' } })

      const result = await prisma.user.create({ data: { email: 'user@example.com' } }).catch((e) => e)

      expect(result.name).toEqual('PrismaClientKnownRequestError')
      expect(result.code).toEqual('P2002')

      switch (suiteConfig.provider) {
        // Adapters for these providers resolve the violated field names.
        case Providers.POSTGRESQL:
        case Providers.COCKROACHDB:
        case Providers.SQLITE:
          expect(result.meta.target).toEqual(['email'])
          break
        // The MySQL adapters only know the name of the violated index.
        case Providers.MYSQL:
          expect(result.meta.target).toEqual('User_email_key')
          break
        // The SQL Server adapter also reports an index name, but its exact
        // value depends on whether the violation comes from a unique
        // constraint or a unique index.
        case Providers.SQLSERVER:
          expect(typeof result.meta.target).toEqual('string')
          break
        default:
          throw new Error(`Unexpected provider ${suiteConfig.provider}`)
      }
    })

    // SQLite adapters don't enable the `foreign_keys` pragma, so foreign keys
    // are not enforced and the insert below succeeds there.
    testIf(suiteConfig.provider !== Providers.SQLITE)(
      'foreign key constraint violation (P2003) populates meta.constraint',
      async () => {
        const result = await prisma.post.create({ data: { authorId: 'nonexistent-user-id' } }).catch((e) => e)

        expect(result.name).toEqual('PrismaClientKnownRequestError')
        expect(result.code).toEqual('P2003')

        switch (suiteConfig.provider) {
          // Adapters for these providers report the violated constraint name.
          case Providers.POSTGRESQL:
          case Providers.COCKROACHDB:
          case Providers.SQLSERVER:
            expect(result.meta.constraint).toEqual('Post_authorId_fkey')
            break
          // The MySQL adapters resolve the violated field names.
          case Providers.MYSQL:
            expect(result.meta.constraint).toEqual(['authorId'])
            break
          default:
            throw new Error(`Unexpected provider ${suiteConfig.provider}`)
        }
      },
    )
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'the meta.target/meta.constraint mapping under test is specific to SQL driver adapters',
    },
    skipDriverAdapter: {
      from: ['js_planetscale', 'js_d1'],
      reason: 'these adapters cannot extract the violated constraint from the underlying driver error messages',
    },
  },
)
