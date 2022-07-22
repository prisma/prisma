import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'
import { checkIfEmpty } from './_utils'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// m:n relation (MongoDB database)
async function createXPostsWith2CategoriesMongoDB({ count, postModel }) {
  const prismaPromises: any = []

  for (let i = 0; i < count; i++) {
    // We want to start at 1
    const id = (i + 1).toString()
    const prismaPromise = prisma[postModel].create({
      data: {
        id: id,
        categories: {
          create: [
            {
              id: `${id}-cat-a`,
            },
            {
              id: `${id}-cat-b`,
            },
          ],
        },
      },
      include: {
        categories: true,
      },
    })
    prismaPromises.push(prismaPromise)
  }

  return await prisma.$transaction(prismaPromises)
}

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const { onDelete } = suiteConfig.referentialActions

    /**
     * m:n relationship
     */
    describeIf(suiteConfig.provider === Providers.MONGODB)('m:n mandatory (explicit) - MongoDB', () => {
      const postModel = 'PostManyToMany'
      const categoryModel = 'CategoryManyToMany'

      beforeEach(async () => {
        const prismaPromises = [prisma[postModel].deleteMany(), prisma[categoryModel].deleteMany()]
        await prisma.$transaction(prismaPromises)
      })

      describe('[create]', () => {
        test('[create] catgegory alone should succeed', async () => {
          await prisma[categoryModel].create({
            data: {
              id: '1',
            },
          })
          expect(await prisma[categoryModel].findMany()).toEqual([
            {
              id: '1',
              postIDs: [],
            },
          ])
        })

        test('[create] post alone should succeed', async () => {
          await prisma[postModel].create({
            data: {
              id: '1',
            },
          })
          expect(await prisma[postModel].findMany()).toEqual([
            {
              id: '1',
              categoryIDs: [],
            },
          ])
        })

        test('[create] create post [nested] [create] categories [nested] [create] category should succeed', async () => {
          await prisma[postModel].create({
            data: {
              id: '1',
              categories: {
                create: [
                  {
                    id: '1',
                  },
                ],
              },
            },
          })

          expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
            {
              id: '1',
              categoryIDs: ['1'],
            },
          ])
          expect(await prisma[categoryModel].findMany()).toEqual([
            {
              id: '1',
              postIDs: ['1'],
            },
          ])
        })

        test.skip('[create] x connect with non existing x should throw', async () => {})
      })

      // MongoDB id is immutable
      describe.skip('[update]', () => {})

      describe('[delete]', () => {
        beforeEach(async () => {
          await checkIfEmpty(categoryModel, postModel)
          await createXPostsWith2CategoriesMongoDB({
            count: 2,
            postModel,
          })
        })

        describeIf(['DEFAULT', 'Restrict', 'NoAction'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          test('[delete] post should throw', async () => {
            // TODO Resolved to value: {"categoryIDs": ["1-cat-a", "1-cat-b"], "id": "1"}
            await expect(
              prisma[postModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError()
          })
          test('[delete] category should throw', async () => {
            // TODO:  Resolved to value: {"id": "1-cat-a", "postIDs": ["1"]}
            await expect(
              prisma[categoryModel].delete({
                where: { id: '1-cat-a' },
              }),
            ).rejects.toThrowError()
          })
        })

        // describeIf(['Cascade'].includes(onDelete))('onDelete: Cascade', () => {
        describe(`onDelete: ${onDelete}`, () => {
          test('[delete] post should succeed', async () => {
            await prisma[postModel].delete({
              where: { id: '1' },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
              {
                id: '2',
                categoryIDs: ['2-cat-a', '2-cat-b'],
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-cat-a',
                postIDs: ['1'],
              },
              {
                id: '1-cat-b',
                postIDs: ['1'],
              },
              {
                id: '2-cat-a',
                postIDs: ['2'],
              },
              {
                id: '2-cat-b',
                postIDs: ['2'],
              },
            ])
          })
          test('[delete] category should succeed', async () => {
            await prisma[categoryModel].delete({
              where: { id: '1-cat-a' },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
              {
                id: '1',
                categoryIDs: ['1-cat-a', '1-cat-b'],
              },
              {
                id: '2',
                categoryIDs: ['2-cat-a', '2-cat-b'],
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-cat-b',
                postIDs: ['1'],
              },
              {
                id: '2-cat-a',
                postIDs: ['2'],
              },
              {
                id: '2-cat-b',
                postIDs: ['2'],
              },
            ])
          })
        })

        describeIf(['SetNull'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          test('[delete] post should throw', async () => {
            // TODO Resolved to value: {"categoryIDs": ["1-cat-a", "1-cat-b"], "id": "1"}
            await expect(
              prisma[postModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError()
          })
          test('[delete] category should throw', async () => {
            // TODO Resolved to value: {"id": "1-cat-a", "postIDs": ["1"]}
            await expect(
              prisma[categoryModel].delete({
                where: { id: '1-cat-a' },
              }),
            ).rejects.toThrowError()
          })
        })
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
