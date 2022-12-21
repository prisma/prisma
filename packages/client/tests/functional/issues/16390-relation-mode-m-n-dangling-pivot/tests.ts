import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    describe('issue 16390', () => {
      afterEach(async () => {
        // Start from a clean state
        await prisma.item.deleteMany({})
        await prisma.category.deleteMany({})
        if (suiteConfig['provider'] === 'mysql') {
          await prisma.$executeRaw`TRUNCATE TABLE \`_CategoryToItem\`;`
        } else {
          await prisma.$executeRaw`TRUNCATE TABLE "_CategoryToItem";`
        }
      })

      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('when deleting an item, the corresponding entry in the implicit pivot table should be deleted', async () => {
        // Create one category
        const category = await prisma.category.create({
          data: {},
        })
        expect(category).toMatchObject({
          id: 1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })

        // Create one item linked to the category
        const item = await prisma.item.create({
          data: {
            categories: {
              connect: {
                id: category.id,
              },
            },
          },
          include: {
            categories: true,
          },
        })
        expect(item).toMatchObject({
          categories: [{ id: 1, createdAt: expect.any(Date), updatedAt: expect.any(Date) }],
          id: 1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })

        // Check the pivot table entries
        let pivotTable
        if (suiteConfig['provider'] === 'mysql') {
          pivotTable = await prisma.$queryRaw`SELECT * FROM \`_CategoryToItem\`;`
        } else {
          pivotTable = await prisma.$queryRaw`SELECT * FROM "_CategoryToItem";`
        }
        expect(pivotTable).toMatchInlineSnapshot(`
          [
            {
              A: 1,
              B: 1,
            },
          ]
        `)

        // Delete the item
        expect(
          await prisma.item.delete({
            where: {
              id: item.id,
            },
          }),
        ).toMatchObject({
          id: 1,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })

        // Item query now returns null
        expect(
          await prisma.item.findUnique({
            where: {
              id: item.id,
            },
            include: {
              categories: true,
            },
          }),
        ).toBeNull()

        // Category has no items
        expect(
          await prisma.category.findUnique({
            where: {
              id: category.id,
            },
            include: {
              items: true,
            },
          }),
        ).toMatchObject({
          id: 1,
          items: [],
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })

        // Everything looks good but....
        // Let's check the pivot table

        // Check the pivot table entries
        let pivotTableAfterDelete
        if (suiteConfig['provider'] === 'mysql') {
          pivotTableAfterDelete = await prisma.$queryRaw`SELECT * FROM \`_CategoryToItem\`;`
        } else {
          pivotTableAfterDelete = await prisma.$queryRaw`SELECT * FROM "_CategoryToItem";`
        }

        // ... the pivot table entry is still there!
        // This is a bug in the relationMode="prisma" emulation
        if (suiteConfig.relationMode === 'prisma') {
          expect(pivotTableAfterDelete).toStrictEqual([
            {
              A: 1,
              B: 1,
            },
          ])
        } else {
          // This is the expected behavior for prisma and foreignKeys
          // once this bug is fixed
          expect(pivotTableAfterDelete).toStrictEqual([])
        }
      })
    })

    test('when deleting a category, the corresponding entry in the implicit pivot table should be deleted', async () => {
      // Create one category
      const category = await prisma.category.create({
        data: {},
      })
      expect(category).toMatchObject({
        id: 2,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })

      // Create one item linked to the category
      const item = await prisma.item.create({
        data: {
          categories: {
            connect: {
              id: category.id,
            },
          },
        },
        include: {
          categories: true,
        },
      })
      expect(item).toMatchObject({
        categories: [{ id: 2, createdAt: expect.any(Date), updatedAt: expect.any(Date) }],
        id: 2,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })

      // Check the pivot table entries
      let pivotTable
      if (suiteConfig['provider'] === 'mysql') {
        pivotTable = await prisma.$queryRaw`SELECT * FROM \`_CategoryToItem\`;`
      } else {
        pivotTable = await prisma.$queryRaw`SELECT * FROM "_CategoryToItem";`
      }
      expect(pivotTable).toMatchInlineSnapshot(`
        [
          {
            A: 2,
            B: 2,
          },
        ]
      `)

      // Delete the category
      expect(
        await prisma.category.delete({
          where: {
            id: item.id,
          },
        }),
      ).toMatchObject({
        id: 2,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })

      // Category query now returns null
      expect(
        await prisma.category.findUnique({
          where: {
            id: category.id,
          },
          include: {
            items: true,
          },
        }),
      ).toBeNull()

      // Item has no category
      expect(
        await prisma.item.findUnique({
          where: {
            id: item.id,
          },
          include: {
            categories: true,
          },
        }),
      ).toMatchObject({
        id: 2,
        categories: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })

      // Everything looks good but....
      // Let's check the pivot table

      // Check the pivot table entries
      let pivotTableAfterDelete
      if (suiteConfig['provider'] === 'mysql') {
        pivotTableAfterDelete = await prisma.$queryRaw`SELECT * FROM \`_CategoryToItem\`;`
      } else {
        pivotTableAfterDelete = await prisma.$queryRaw`SELECT * FROM "_CategoryToItem";`
      }

      // ... the pivot table entry is still there!
      // This is a bug in the relationMode="prisma" emulation
      //
      // TODO once the bug is fixed: remove conditional
      // pivot table should be empty
      if (suiteConfig.relationMode === 'prisma') {
        expect(pivotTableAfterDelete).toStrictEqual([
          {
            A: 2,
            B: 2,
          },
        ])
      } else {
        // This is the expected behavior for prisma and foreignKeys
        // once this bug is fixed
        expect(pivotTableAfterDelete).toStrictEqual([])
      }
    })
  },
  // Use `optOut` to opt out from testing the default selected providers
  // otherwise the suite will require all providers to be specified.
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Only testing postgresql and mysql',
    },
  },
)
