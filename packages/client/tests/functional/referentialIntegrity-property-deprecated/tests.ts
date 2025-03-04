import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (_suiteConfig, _suiteMeta) => {
    describe('relationMode with deprecated `referentialIntegrity` datasource property', () => {
      beforeEach(async () => {
        await prisma.$transaction([prisma.profileOneToOne.deleteMany(), prisma.userOneToOne.deleteMany()])
      })
      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('[create] and [delete] should succeed', async () => {
        await prisma.userOneToOne.create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
          include: {
            profile: true,
          },
        })

        expect(await prisma.userOneToOne.findMany()).toEqual([
          {
            id: '1',
            enabled: null,
          },
        ])
        expect(await prisma.profileOneToOne.findMany()).toEqual([
          {
            id: '1',
            userId: '1',
            enabled: null,
          },
        ])

        // onDelete: Cascade
        await prisma.userOneToOne.deleteMany()

        expect(await prisma.userOneToOne.findMany()).toEqual([])
        expect(await prisma.profileOneToOne.findMany()).toEqual([])
      })
    })
  },
  {
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.MONGODB],
      reason: 'Only testing SQLite, as this is just for testing the deprecated property',
    },
  },
)
