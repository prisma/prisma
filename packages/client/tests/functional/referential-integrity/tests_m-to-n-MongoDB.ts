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

// If no change
const expectedFindManyPostModel = [
  {
    id: '1',
    published: null,
    categoryIDs: ['1-cat-a', '1-cat-b'],
  },
  {
    id: '2',
    published: null,
    categoryIDs: ['2-cat-a', '2-cat-b'],
  },
]
const expectedFindManyCategoryModel = [
  {
    id: '1-cat-a',
    published: null,
    postIDs: ['1'],
  },
  {
    id: '1-cat-b',
    published: null,
    postIDs: ['1'],
  },
  {
    id: '2-cat-a',
    published: null,
    postIDs: ['2'],
  },
  {
    id: '2-cat-b',
    published: null,
    postIDs: ['2'],
  },
]

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const { onDelete } = suiteConfig.referentialActions
    const { onUpdate } = suiteConfig.referentialActions

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
              published: null,
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
              published: null,
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
              published: null,
              categoryIDs: ['1'],
            },
          ])
          expect(await prisma[categoryModel].findMany()).toEqual([
            {
              id: '1',
              published: null,
              postIDs: ['1'],
            },
          ])
        })

        test.skip('[create] x connect with non existing x should throw', async () => {})
      })

      describe('[update]', () => {
        beforeEach(async () => {
          await checkIfEmpty(categoryModel, postModel)
          await createXPostsWith2CategoriesMongoDB({
            count: 2,
            postModel,
          })
        })

        // Note: it's not possible on MongoDB to mutate _id, it is immutable
        test('[update] id (_id) should throw a type error', async () => {
          expect(
            prisma[postModel].update({
              where: {
                id: '1',
              },
              data: {
                id: 'new id',
              },
            }),
          ).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`prisma[postModel].update()\` invocation in
            /client/tests/functional/referential-integrity/tests_m-to-n-MongoDB.ts:173:31

              170 // Note: it's not possible on MongoDB to mutate _id, it is immutable
              171 test('[update] id (_id) should throw a type error', async () => {
              172   expect(
            → 173     prisma[postModel].update({
                        where: {
                          id: '1'
                        },
                        data: {
                          id: 'new id'
                          ~~
                        }
                      })

            Unknown arg \`id\` in data.id for type PostManyToManyUpdateInput. Available args:

            type PostManyToManyUpdateInput {
              categoryIDs?: PostManyToManyUpdatecategoryIDsInput | List<String>
              categories?: CategoryManyToManyUpdateManyWithoutPostsNestedInput
              published?: Boolean | NullableBoolFieldUpdateOperationsInput | Null
            }


          `)
        })

        test('[update] (post) optional boolean field should succeed', async () => {
          await prisma[postModel].update({
            where: {
              id: '1',
            },
            data: {
              published: true,
            },
          })

          expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
            {
              id: '1',
              // The update
              published: true,
              categoryIDs: ['1-cat-a', '1-cat-b'],
            },
            {
              id: '2',
              published: null,
              categoryIDs: ['2-cat-a', '2-cat-b'],
            },
          ])
          expect(
            await prisma[categoryModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual(expectedFindManyCategoryModel)
        })

        test('[update] (category): optional boolean field should succeed', async () => {
          await prisma[categoryModel].update({
            where: {
              id: '1-cat-a',
            },
            data: {
              published: true,
            },
          })

          expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual(expectedFindManyPostModel)
          expect(
            await prisma[categoryModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1-cat-a',
              // The update
              published: true,
              postIDs: ['1'],
            },
            {
              id: '1-cat-b',
              published: null,
              postIDs: ['1'],
            },
            {
              id: '2-cat-a',
              published: null,
              postIDs: ['2'],
            },
            {
              id: '2-cat-b',
              published: null,
              postIDs: ['2'],
            },
          ])
        })
      })

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
            // TODO Resolved to value: {"categoryIDs": ["1-cat-a", "1-cat-b"], "id": "1", "published": null}
            await expect(
              prisma[postModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError()
          })
          test('[delete] category should throw', async () => {
            // TODO:  Resolved to value: {"id": "1-cat-a", "postIDs": ["1"], "published": null}
            await expect(
              prisma[categoryModel].delete({
                where: { id: '1-cat-a' },
              }),
            ).rejects.toThrowError()
          })
        })

        describe(`onDelete: ${onDelete}`, () => {
          test('[delete] post should succeed', async () => {
            await prisma[postModel].delete({
              where: { id: '1' },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
              {
                id: '2',
                published: null,
                categoryIDs: ['2-cat-a', '2-cat-b'],
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual(expectedFindManyCategoryModel)
          })
          test('[delete] category should succeed', async () => {
            await prisma[categoryModel].delete({
              where: { id: '1-cat-a' },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual(expectedFindManyPostModel)
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-cat-b',
                published: null,
                postIDs: ['1'],
              },
              {
                id: '2-cat-a',
                published: null,
                postIDs: ['2'],
              },
              {
                id: '2-cat-b',
                published: null,
                postIDs: ['2'],
              },
            ])
          })
        })

        describeIf(['SetNull'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          test('[delete] post should throw', async () => {
            // TODO Resolved to value: {"categoryIDs": ["1-cat-a", "1-cat-b"], "id": "1", "published": null}
            await expect(
              prisma[postModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError()
          })
          test('[delete] category should throw', async () => {
            // TODO Resolved to value: {"id": "1-cat-a", "postIDs": ["1"], "published": null}
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
