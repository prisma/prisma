import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      // Prisma Schema does not support specifying column collation
      await prisma.$executeRaw`ALTER TABLE \`User\` MODIFY \`str_bin_collation\` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL`
    })

    beforeEach(async () => {
      await prisma.user.deleteMany()
    })

    test('columns with _bin collation return strings, not Uint8Array', async () => {
      await prisma.user.create({
        data: {
          str: 'hello',
          str_bin_collation: 'world',
        },
      })

      const result =
        (await prisma.$queryRaw`SELECT \`str\`, \`str_bin_collation\` FROM \`User\` ORDER BY \`str\``) as Array<
          Record<string, unknown>
        >

      expect(result).toHaveLength(1)
      expect(result[0].str).toBe('hello')
      expect(result[0].str_bin_collation).toBe('world')
    })
  },
  {
    optOut: {
      from: [Providers.POSTGRESQL, Providers.SQLITE, Providers.MONGODB, Providers.COCKROACHDB, Providers.SQLSERVER],
      reason: 'This test is for MySQL-specific column type detection',
    },
  },
)
