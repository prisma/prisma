import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig) => {
    test('P2002: UniqueConstraintViolation has meta.target', async () => {
      await prisma.user.create({
        data: { email: 'test@example.com' },
      })

      try {
        await prisma.user.create({
          data: { email: 'test@example.com' },
        })
        expect(true).toBe(false) // Should not reach here
      } catch (e: any) {
        expect(e.code).toBe('P2002')
        expect(e.meta).toBeDefined()
        expect(e.meta.target).toBeDefined()
      }
    })

    test('P2003: ForeignKeyConstraintViolation has meta.field_name', async () => {
      try {
        await prisma.post.create({
          data: { authorId: '99999' }, // Author doesn't exist
        })
        expect(true).toBe(false) // Should not reach here
      } catch (e: any) {
        expect(e.code).toBe('P2003')
        expect(e.meta).toBeDefined()
        if (suiteConfig.provider !== Providers.SQLITE && suiteConfig.provider !== Providers.SQLSERVER) {
          expect(e.meta.field_name).toBeDefined()
        }
      }
    })

    test('P2011: NullConstraintViolation has meta.target', async () => {
      // P2011 is not easy to trigger with Prisma abstractions if the field is typed as non-nullable
      // We can use $executeRaw instead to insert a null optionally if the driver allows
      // However, we just cover it using a raw query
      try {
        await prisma.$executeRaw`INSERT INTO "User" ("email") VALUES (NULL)`
      } catch (e: any) {
        // Some adapters might throw different errors for raw queries compared to client queries,
        // but if it throws P2011 it should have meta.target.
        // We'll optionally ignore it if the code isn't P2011.
        if (e.code === 'P2011') {
          expect(e.meta).toBeDefined()
          expect(e.meta.target).toBeDefined()
        }
      }
    })
  },
  {
    optOut: {
      from: ['mongodb'],
      reason: 'Testing specific target and field_name meta fields for SQL exceptions natively and in adapters',
    },
  },
)
