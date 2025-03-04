/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
// @ts-ignore
import type { PrismaClient, Prisma as PrismaNamespace } from '@prisma/client'

import testMatrix from './_matrix'

testMatrix.setupTestSuite(
  () => {
    test('return types must be compatible with returned data types in classes (type test only)', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class Test {
        private prismaClient!: PrismaClient

        public getUser<T extends PrismaNamespace.UserSelect>(
          id: string,
          select: T,
        ): Promise<PrismaNamespace.UserGetPayload<{ select: T }> | null> {
          return this.prismaClient.user.findUnique({
            where: { id },
            select,
          })
        }
      }
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true,
  },
)
