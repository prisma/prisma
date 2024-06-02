import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore this is just for type checks
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue 12557', () => {
      beforeAll(() => {
        prisma = newPrismaClient({
          // log: [ 'query' ],
        })
      })

      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('issue 12557', async () => {
        await prisma.category.create({
          data: {
            name: 'cat-1',
            brands: {
              create: [{ name: 'brand-1' }, { name: 'brand-2' }],
            },
          },
        })

        await prisma.category.create({
          data: {
            name: 'cat-2',
            brands: {
              create: [{ name: 'brand-3' }, { name: 'brand-4' }],
            },
          },
          include: { brands: true },
        })

        const categories = await prisma.category.findMany({
          include: {
            _count: {
              select: { brands: true },
            },
          },
        })
        expect(categories).toMatchObject([
          {
            _count: { brands: 2 },
            name: 'cat-1',
          },
          {
            _count: { brands: 2 },
            name: 'cat-2',
          },
        ])

        await prisma.brand.delete({ where: { name: 'brand-1' } })

        const categoriesAfterBrand1Deletion = await prisma.category.findMany({
          include: {
            _count: {
              select: { brands: true },
            },
          },
        })
        expect(categoriesAfterBrand1Deletion).toMatchObject([
          {
            _count: { brands: 1 },
            name: 'cat-1',
          },
          {
            _count: { brands: 2 },
            name: 'cat-2',
          },
        ])
      })
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'lazyness for now',
    },
  },
)
