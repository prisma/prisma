import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue 10000', () => {
      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('', async () => {
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
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver', 'mysql', 'postgresql'],
      reason: 'Only testing xyz provider(s) so opting out of xxx',
    },
  },
)
