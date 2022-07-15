import { Providers } from '../_utils/providers'
import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

// 1:1 relation
async function createXUsersWithAProfile({ count, userModel, profileModel, profileColumn }) {
  const prismaPromises: any = []

  for (let i = 0; i < count; i++) {
    // We want to start at 1
    const id = (i + 1).toString()
    const prismaPromise = prisma[userModel].create({
      data: {
        id: id,
        [profileColumn]: {
          create: { id: id },
        },
      },
      include: {
        [profileColumn]: true,
      },
    })
    prismaPromises.push(prismaPromise)
  }

  return await prisma.$transaction(prismaPromises)
}

// 1:n relation
async function createXUsersWith2Posts({ count, userModel, postModel, postColumn }) {
  const prismaPromises = [] as Array<Promise<any>>

  for (let i = 1; i <= count; i++) {
    const id = i.toString()
    const prismaPromise = prisma[userModel].create({
      data: {
        id,
        [postColumn]: {
          createMany: {
            data: [{ id: `${id}-post-a` }, { id: `${id}-post-b` }],
          },
        },
      },
      include: {
        [postColumn]: true,
      },
    })

    prismaPromises.push(prismaPromise)
  }

  return await prisma.$transaction(prismaPromises)
}

// m:n relation (SQL database)
async function createXPostsWith2Categories({ count, postModel }) {
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
              category: {
                create: {
                  id: `${id}-cat-a`,
                },
              },
            },
            {
              category: {
                create: {
                  id: `${id}-cat-b`,
                },
              },
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

async function checkIfEmpty(...models: unknown[]) {
  const checkEmptyArr = await prisma.$transaction(models.map((model) => prisma[model].findMany()))
  checkEmptyArr.forEach((checkEmpty) => {
    expect(checkEmpty).toHaveLength(0)
  })
}

// TODO: why would we use this rather than relying on "orderBy: { id: asc }"?
// Order is different depending on the provider?
function sortArrayById(arr) {
  return arr.sort((a, b) => a.id.localeCompare(b.id))
}

async function checkForNoChange({ count, userColumn, profileColumn, userModel, profileModel, usersArr }) {
  const [findManyUserById1, findManyProfileById1] = await prisma.$transaction([
    prisma[userModel].findMany({
      include: {
        [profileColumn]: true,
      },
    }),
    prisma[profileModel].findMany({}),
  ])
  expect(findManyUserById1).toHaveLength(count)
  expect(findManyProfileById1).toHaveLength(count)
  expect(sortArrayById(findManyUserById1)).toMatchObject(sortArrayById(usersArr))
}

// TODO: maybe we can split each relation into a separate file for readability
testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    function conditionalError(errors: Record<Providers, string>): string {
      return errors[suiteConfig.provider]
    }
    const onDelete = suiteConfig.referentialActions.onDelete
    const onUpdate = suiteConfig.referentialActions.onUpdate

    // we can create a user without a profile, but not a profile without a user
    describe('1:1 mandatory (explicit)', () => {
      const userModel = 'userOneToOne'
      const profileModel = 'profileOneToOne'
      const profileColumn = 'profile'

      beforeEach(async () => {
        await prisma.$transaction([prisma[profileModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      describe('[create]', () => {
        // TODO: this doesn't throw with "referentialIntegrity: prisma"
        test('[create] child with non existing parent should throw', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                userId: '1',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
            }),
          )
        })

        test('[create] child with undefined parent should throw with type error', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                userId: undefined, // this would actually be a type-error, but we don't have access to types here
              },
            }),
          ).rejects.toThrowError('Argument user for data.user is missing.')
        })

        test('[create] nested child [create]', async () => {
          const user1 = await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
            include: { profile: true },
          })
          expect(user1).toEqual({
            id: '1',
            profile: {
              id: '1',
              userId: '1',
            },
          })

          const profile1 = await prisma[profileModel].findUniqueOrThrow({
            where: { userId: '1' },
          })
          expect(profile1).toEqual({
            id: '1',
            userId: '1',
          })
          const user1Copy = await prisma[userModel].findUniqueOrThrow({
            where: { id: '1' },
          })
          expect(user1Copy).toEqual({
            id: '1',
          })
        })
      })

      //
      // TODO more create cases
      //

      describe('[update]', () => {
        /*
      * Update
      // - [ ]  user.update
      //     - [ ]  valid id
      //     - [ ]  invalid id
      // - [ ]  user.updateMany
      //     - [ ]  valid id
      //     - [ ]  invalid id
      // - [ ]  user.upsert
      //     - [ ]  valid id
      //     - [ ]  invalid id
      // - [ ]  user nested:
      //     - [ ]  connect (only if optional) (if required is it available, probably not?)
      //         - [ ]
      //     - [ ]  disconnect should throw if required (is it even available?)
      //     - [ ]  update
      //     - [ ]  updateMany
      //     - [ ]  upsert
      */

        beforeEach(async () => {
          await checkIfEmpty(userModel, profileModel)
          await createXUsersWithAProfile({
            count: 2,
            userModel,
            profileModel,
            profileColumn,
          })
        })

        test('[update] parent id with non-existing id should succeed', async () => {
          const user1WithNewId = await prisma[userModel].update({
            where: { id: '1' },
            data: {
              id: '3', // TODO: Type error, Invalid `prisma[userModel].update()` with Mongo.
            },
          })
          expect(user1WithNewId).toEqual({
            id: '3',
          })

          // Checks
          const profileNull = await prisma[profileModel].findFirst({
            where: { userId: '1' },
          })
          expect(profileNull).toEqual(null)
          const profiles = await prisma[profileModel].findMany({
            orderBy: [{ id: 'asc' }],
          })
          expect(profiles).toEqual([
            {
              id: '1',
              userId: '3',
            },
            {
              id: '2',
              userId: '2',
            },
          ])
        })

        test('[update] parent id with existing id should throw', async () => {
          await expect(
            prisma[userModel].update({
              where: { id: '1' },
              data: {
                // TODO: Type error with MongoDB, Unknown arg `id` in data.id for type UserOneToOneUpdateInput.
                id: '2', // existing id
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.MYSQL]:
                "Foreign key constraint for table 'UserOneToOne', record '2' would lead to a duplicate entry in table 'ProfileOneToOne', key 'ProfileOneToOne_userId_key'",
            }),
          )
        })

        test('[update] child id with non-existing id should succeed', async () => {
          const profile1WithNewId = await prisma[profileModel].update({
            where: { id: '1' },
            data: {
              id: '3', // TODO: Type error with MongoDB, Invalid `prisma[profileModel].update()` invocation
            },
          })
          expect(profile1WithNewId).toEqual({
            id: '3',
            userId: '1',
          })

          const user1WithUpdatedProfile = await prisma[userModel].findUniqueOrThrow({
            where: { id: '1' },
            include: { profile: true },
          })
          expect(user1WithUpdatedProfile).toEqual({
            id: '1',
            profile: {
              id: '3',
              userId: '1',
            },
          })

          const profiles = await prisma[profileModel].findMany({
            orderBy: [{ id: 'asc' }],
          })
          expect(profiles).toEqual([
            {
              id: '2',
              userId: '2',
            },
            {
              id: '3',
              userId: '1',
            },
          ])
        })

        test('[update] child id with existing id should throw', async () => {
          await expect(
            prisma[profileModel].update({
              where: { id: '1' },
              data: {
                id: '2', // existing id
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
            }),
          )
        })

        test('[updateMany] parent id should succeed', async () => {
          await prisma[userModel].updateMany({
            data: { id: '3' },
            where: { id: '1' },
          })

          await expect(
            prisma[userModel].findUnique({
              where: { id: '1' },
            }),
          ).resolves.toEqual(null)

          const user1WithNewId = await prisma[userModel].findUniqueOrThrow({
            where: { id: '3' },
            include: { profile: true },
          })
          expect(user1WithNewId).toEqual({
            id: '3',
            profile: {
              id: '1',
              userId: '3',
            },
          })

          const profile1FromUser3 = await prisma[profileModel].findUniqueOrThrow({
            where: { userId: '3' },
          })
          expect(profile1FromUser3).toEqual({
            id: '1',
            userId: '3',
          })
        })

        test('[updateMany] parent id with existing id should throw', async () => {
          await expect(
            prisma[userModel].updateMany({
              data: { id: '2' }, // existing id
              where: { id: '1' },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.MYSQL]:
                "Foreign key constraint for table 'UserOneToOne', record '2' would lead to a duplicate entry in table 'ProfileOneToOne', key 'ProfileOneToOne_userId_key'",
            }),
          )
        })

        test("[update] nested child [connect] child should succeed if the relationship didn't exist", async () => {
          await prisma[userModel].create({
            data: {
              id: '3',
            },
          })

          await prisma[userModel].update({
            where: { id: '3' },
            data: {
              profile: {
                connect: { id: '2' },
              },
            },
          })

          await expect(prisma[userModel].findMany({})).resolves.toEqual([
            {
              id: '1',
            },
            {
              id: '2',
            },
            {
              id: '3',
            },
          ])
          await expect(prisma[profileModel].findMany({})).resolves.toEqual([
            {
              id: '1',
              userId: '1',
            },
            {
              id: '2',
              userId: '3',
            },
          ])
        })

        test('[update] nested child [connect] should succeed if the relationship already existed', async () => {
          // TODO: this is probably a bug, this operation should be idempotent and succeed
          await expect(
            prisma[userModel].update({
              where: { id: '1' },
              data: {
                profile: {
                  connect: { id: '1' },
                },
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
              [Providers.COCKROACHDB]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
              [Providers.MYSQL]:
                "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
            }),
          )
        })

        test('[update] nested child [disconnect] should throw', async () => {
          await expect(
            prisma[userModel].update({
              where: { id: '1' },
              data: {
                profile: {
                  disconnect: true,
                },
              },
            }),
          ).rejects.toThrowError(
            "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
          )
        })

        test('[update] nested child [update] should succeed', async () => {
          await prisma[userModel].update({
            where: { id: '1' },
            data: {
              profile: {
                update: {
                  id: '4',
                },
              },
            },
          })

          await expect(prisma[userModel].findMany({})).resolves.toEqual([
            {
              id: '1',
            },
            {
              id: '2',
            },
          ])
          await expect(
            prisma[profileModel].findMany({
              // Needed for MySQL
              orderBy: [{ id: 'asc' }],
            }),
          ).resolves.toEqual([
            {
              id: '2',
              userId: '2',
            },
            {
              id: '4',
              userId: '1',
            },
          ])
        })

        // user.upsert, post.upsert

        // This is ok for 1-to-n and m-to-m
        test.skip('[update] nested child [updateMany] should succeed', async () => {})
        test.skip('[update] nested child [upsert] child should succeed', async () => {})
        test.skip('[upsert] parent id should succeed', async () => {})
        test.skip('[upsert] parent id with existing id should throw', async () => {})
      })

      describe('[delete]', () => {
        test('[delete] child should succeed', async () => {
          await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
            include: { profile: true },
          })

          await prisma[userModel].create({
            data: {
              id: '2',
              profile: {
                create: { id: '2' },
              },
            },
            include: { profile: true },
          })

          await prisma[profileModel].delete({
            where: { id: '1' },
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { profile: true },
          })
          expect(usersFromDb).toEqual([
            {
              id: '1',
              profile: null,
            },
            {
              id: '2',
              profile: {
                id: '2',
                userId: '2',
              },
            },
          ])

          const profilesFromDb = await prisma[profileModel].findMany({})
          expect(profilesFromDb).toEqual([
            {
              id: '2',
              userId: '2',
            },
          ])
        })

        test('[delete] child and then [delete] parent should succeed', async () => {
          await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
            include: { profile: true },
          })

          await prisma[userModel].create({
            data: {
              id: '2',
              profile: {
                create: { id: '2' },
              },
            },
            include: { profile: true },
          })

          await prisma[profileModel].delete({
            where: { id: '1' },
          })
          await prisma[userModel].delete({
            where: { id: '1' },
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { profile: true },
          })
          expect(usersFromDb).toEqual([
            {
              id: '2',
              profile: {
                id: '2',
                userId: '2',
              },
            },
          ])

          const profilesFromDb = await prisma[profileModel].findMany({})
          expect(profilesFromDb).toEqual([
            {
              id: '2',
              userId: '2',
            },
          ])
        })

        test.skip('[deleteMany] parents should throw', async () => {
          await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
            include: { profile: true },
          })

          await prisma[userModel].create({
            data: {
              id: '2',
              profile: {
                create: { id: '2' },
              },
            },
            include: { profile: true },
          })
        })

        describeIf(onDelete === 'DEFAULT')('onDelete: DEFAULT', () => {
          test('[delete] parent should throw', async () => {
            await prisma[userModel].create({
              data: {
                id: '1',
                profile: {
                  create: { id: '1' },
                },
              },
              include: { profile: true },
            })

            // this throws because "profileModel" has a mandatory relation with "userModel", hence
            // we have a "onDelete: Restrict" situation by default

            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
              }),
            )
          })
        })

        describeIf(onDelete === 'Cascade')('onDelete: Cascade', () => {
          test('[delete] parent should succeed', async () => {
            await prisma[userModel].create({
              data: {
                id: '1',
                profile: {
                  create: { id: '1' },
                },
              },
              include: { profile: true },
            })

            await prisma[userModel].create({
              data: {
                id: '2',
                profile: {
                  create: { id: '2' },
                },
              },
              include: { profile: true },
            })

            await prisma[userModel].delete({
              where: { id: '1' },
            })

            const usersFromDb = await prisma[userModel].findMany({
              include: { profile: true },
            })
            expect(usersFromDb).toEqual([
              {
                id: '2',
                profile: {
                  id: '2',
                  userId: '2',
                },
              },
            ])

            const profilesFromDb = await prisma[profileModel].findMany({})
            expect(profilesFromDb).toEqual([
              {
                id: '2',
                userId: '2',
              },
            ])
          })
        })

        // describe.skip('onUpdate: DEFAULT', () => {})
        // describe.skip('onUpdate: Cascade', () => {})

        // test('[create] parent and [connect] child with non-existing id should throw', async () => {})
        // test('[create] child and [connect] parent with non-existing id should throw', async () => {})
        // test('[create] child with non-existing parent id should throw', async () => {})
        // test('[update] child with non-existing parent id should throw', async () => {})
        // test('[delete] parent should throw', async () => {})
        // test('[delete] child should suceed', async () => {})
      })
    })

    describe('1-to-n mandatory (explicit)', () => {
      const userModel = 'userOneToMany'
      const postModel = 'postOneToMany'
      const postColumn = 'posts'

      beforeEach(async () => {
        await prisma.$transaction([prisma[postModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      afterEach(async () => {
        await prisma.$disconnect()
      })

      describe('[create]', () => {
        test('[create] child with non existing parent should throw', async () => {
          await expect(
            prisma[postModel].create({
              data: {
                id: '1',
                authorId: '1',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
            }),
          )
        })

        test('[create] child with undefined parent should throw with type error', async () => {
          await expect(
            prisma[postModel].create({
              data: {
                id: '1',
                authorId: undefined, // this would actually be a type-error, but we don't have access to types here
              },
            }),
          ).rejects.toThrowError('Argument author for data.author is missing.')
        })

        test('[create] nested child [create]', async () => {
          const user1 = await prisma[userModel].create({
            data: {
              id: '1',
              posts: {
                create: { id: '1' },
              },
            },
            include: { posts: true },
          })
          expect(user1).toEqual({
            id: '1',
            posts: [
              {
                id: '1',
                authorId: '1',
              },
            ],
          })

          const posts = await prisma[postModel].findMany({
            where: { authorId: '1' },
          })
          expect(posts).toEqual([
            {
              id: '1',
              authorId: '1',
            },
          ])
          const user1Copy = await prisma[userModel].findUniqueOrThrow({
            where: { id: '1' },
          })
          expect(user1Copy).toEqual({
            id: '1',
          })
        })

        test('[create] nested child [createMany]', async () => {
          const user1 = await prisma[userModel].create({
            data: {
              id: '1',
              posts: {
                createMany: {
                  data: [{ id: '1' }, { id: '2' }],
                },
              },
            },
            include: { posts: true },
          })
          expect(user1).toEqual({
            id: '1',
            posts: [
              {
                id: '1',
                authorId: '1',
              },
              {
                id: '2',
                authorId: '1',
              },
            ],
          })

          const postsUser1 = await prisma[postModel].findMany({
            where: { authorId: '1' },
            orderBy: { id: 'asc' },
          })
          expect(postsUser1).toEqual([
            {
              id: '1',
              authorId: '1',
            },
            {
              id: '2',
              authorId: '1',
            },
          ])
          const user1Copy = await prisma[userModel].findUniqueOrThrow({
            where: { id: '1' },
          })
          expect(user1Copy).toEqual({
            id: '1',
          })
        })
      })

      describe('[update]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, postModel)
          await createXUsersWith2Posts({
            count: 2,
            userModel,
            postModel,
            postColumn,
          })
        })

        test('[update] parent id with non-existing id should succeed', async () => {
          const user3 = await prisma[userModel].update({
            where: { id: '1' },
            data: {
              id: '3',
            },
            include: { posts: true },
          })
          expect(user3).toEqual({
            id: '3',
            posts: [
              {
                id: '1-post-a',
                authorId: '3',
              },
              {
                id: '1-post-b',
                authorId: '3',
              },
            ],
          })

          const users = await prisma[userModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(users).toEqual([{ id: '2' }, { id: '3' }])

          const posts = await prisma[postModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(posts).toEqual([
            {
              id: '1-post-a',
              authorId: '3',
            },
            {
              id: '1-post-b',
              authorId: '3',
            },
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })

        test('[update] parent id with existing id should throw', async () => {
          await expect(
            prisma[userModel].update({
              where: { id: '1' },
              data: {
                id: '2',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error
            conditionalError({
              [Providers.POSTGRESQL]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.COCKROACHDB]: 'Unique constraint failed on the fields: (`id`)',
              [Providers.MYSQL]: 'Unique constraint failed on the constraint: `PRIMARY`',
            }),
          )
        })

        test('[update] child id with non-existing id should succeed', async () => {
          const postUser1A = await prisma[postModel].update({
            where: { id: '1-post-a' },
            data: {
              id: '1-post-c',
            },
          })
          expect(postUser1A).toEqual({
            id: '1-post-c',
            authorId: '1',
          })

          const users = await prisma[userModel].findMany({
            orderBy: { id: 'asc' },
            include: { posts: true },
          })
          expect(users).toEqual([
            {
              id: '1',
              posts: [
                {
                  id: '1-post-b',
                  authorId: '1',
                },
                {
                  id: '1-post-c',
                  authorId: '1',
                },
              ],
            },
            {
              id: '2',
              posts: [
                {
                  id: '2-post-a',
                  authorId: '2',
                },
                {
                  id: '2-post-b',
                  authorId: '2',
                },
              ],
            },
          ])

          const posts = await prisma[postModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(posts).toEqual([
            {
              id: '1-post-b',
              authorId: '1',
            },
            {
              id: '1-post-c',
              authorId: '1',
            },
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })
      })

      describe('[delete]', () => {
        beforeEach(async () => {
          await checkIfEmpty(userModel, postModel)
          await createXUsersWith2Posts({
            count: 2,
            userModel,
            postModel,
            postColumn,
          })
        })

        test('[delete] child should succeed', async () => {
          await prisma[postModel].delete({
            where: { id: '1-post-a' },
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { posts: true },
          })
          expect(usersFromDb).toEqual([
            {
              id: '1',
              posts: [
                {
                  id: '1-post-b',
                  authorId: '1',
                },
              ],
            },
            {
              id: '2',
              posts: [
                {
                  id: '2-post-a',
                  authorId: '2',
                },
                {
                  id: '2-post-b',
                  authorId: '2',
                },
              ],
            },
          ])

          const postsFromDb = await prisma[postModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(postsFromDb).toEqual([
            {
              id: '1-post-b',
              authorId: '1',
            },
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })

        test('[delete] children and then [delete] parent should succeed', async () => {
          await prisma[postModel].delete({
            where: { id: '1-post-a' },
          })
          await prisma[postModel].delete({
            where: { id: '1-post-b' },
          })
          await prisma[userModel].delete({
            where: { id: '1' },
          })

          const usersFromDb = await prisma[userModel].findMany({
            include: { posts: true },
          })
          expect(usersFromDb).toEqual([
            {
              id: '2',
              posts: [
                {
                  id: '2-post-a',
                  authorId: '2',
                },
                {
                  id: '2-post-b',
                  authorId: '2',
                },
              ],
            },
          ])

          const postsFromDb = await prisma[postModel].findMany({
            orderBy: { id: 'asc' },
          })
          expect(postsFromDb).toEqual([
            {
              id: '2-post-a',
              authorId: '2',
            },
            {
              id: '2-post-b',
              authorId: '2',
            },
          ])
        })

        test.skip('[deleteMany] parents should throw', async () => {})

        describeIf(onDelete === 'DEFAULT')('onDelete: DEFAULT', () => {
          test('[delete] parent should throw', async () => {
            // this throws because "postModel" has a mandatory relation with "userModel", hence
            // we have a "onDelete: Restrict" situation by default

            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `PostOneToMany_authorId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
              }),
            )
          })

          test('[delete] a subset of children and then [delete] parent should throw', async () => {
            await prisma[postModel].delete({
              where: { id: '1-post-a' },
            })

            const postsFromDb = await prisma[postModel].findMany({
              orderBy: { id: 'asc' },
            })
            expect(postsFromDb).toEqual([
              {
                id: '1-post-b',
                authorId: '1',
              },
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])

            await expect(
              prisma[userModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Integrity constraint violation: cannot delete due to existing foreign key references',
                [Providers.COCKROACHDB]:
                  'Integrity constraint violation: cannot delete due to existing foreign key references',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `authorId`',
              }),
            )
          })
        })

        describeIf(onDelete === 'Cascade')('onDelete: Cascade', () => {
          test('[delete] parent should succeed', async () => {
            await prisma[userModel].delete({
              where: { id: '1' },
            })

            const usersFromDb = await prisma[userModel].findMany({
              include: { posts: true },
            })
            expect(usersFromDb).toEqual([
              {
                id: '2',
                posts: [
                  {
                    id: '2-post-a',
                    authorId: '2',
                  },
                  {
                    id: '2-post-b',
                    authorId: '2',
                  },
                ],
              },
            ])

            const postsFromDb = await prisma[postModel].findMany({
              orderBy: { id: 'asc' },
            })
            expect(postsFromDb).toEqual([
              {
                id: '2-post-a',
                authorId: '2',
              },
              {
                id: '2-post-b',
                authorId: '2',
              },
            ])
          })
        })
      })
    })

    // Many to Many - m:n
    describe('m-to-n mandatory (explicit)', () => {
      const postModel = 'PostManyToMany'
      const categoryModel = 'CategoryManyToMany'
      const categoriesOnPostsModel = 'CategoriesOnPostsManyToMany'

      beforeEach(async () => {
        const prismaPromises = [prisma[postModel].deleteMany(), prisma[categoryModel].deleteMany()]
        if (suiteConfig.provider !== Providers.MONGODB) {
          prismaPromises.unshift(prisma[categoriesOnPostsModel].deleteMany())
        }
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
            },
          ])
        })

        test('[create] categoriesOnPostsModel with non-existing post and category id should throw', async () => {
          await expect(
            prisma[categoriesOnPostsModel].create({
              data: {
                postId: '99',
                categoryId: '99',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_postId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `postId`',
            }),
          )
        })

        test('[create] create post [nested] [create] categories [nested] [create] category should succeed', async () => {
          await prisma[postModel].create({
            data: {
              id: '1',
              categories: {
                create: [
                  {
                    category: {
                      create: {
                        id: '1',
                      },
                    },
                  },
                ],
              },
            },
          })
        })

        test.skip('[create] x connect with non existing x should throw', async () => {})
      })

      describe('[update]', () => {
        beforeEach(async () => {
          await checkIfEmpty(categoryModel, postModel, categoriesOnPostsModel)
          await createXPostsWith2Categories({
            count: 2,
            postModel,
          })
        })

        test('[update] categoriesOnPostsModel with non-existing postId should throw', async () => {
          await expect(
            prisma[categoriesOnPostsModel].update({
              where: {
                postId_categoryId: {
                  categoryId: '1-cat-a',
                  postId: '1',
                },
              },
              data: {
                postId: '99',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_postId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `postId`',
            }),
          )
        })

        test('[update] categoriesOnPostsModel with non-existing categoryId should throw', async () => {
          await expect(
            prisma[categoriesOnPostsModel].update({
              where: {
                postId_categoryId: {
                  categoryId: '1-cat-a',
                  postId: '1',
                },
              },
              data: {
                categoryId: '99',
              },
            }),
          ).rejects.toThrowError(
            // @ts-expect-error: all providers ought to be logged
            conditionalError({
              [Providers.POSTGRESQL]:
                'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_categoryId_fkey (index)`',
              [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
              [Providers.MYSQL]: 'Foreign key constraint failed on the field: `categoryId`',
            }),
          )
        })

        describeIf(['DEFAULT', 'Cascade'].includes(onUpdate))(`onUpdate: Cascade`, () => {
          test('[update] post id should succeed', async () => {
            await prisma[postModel].update({
              where: {
                id: '1',
              },
              data: {
                id: '3',
              },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
              {
                id: '2',
              },
              {
                // The update
                id: '3',
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-cat-a',
              },
              {
                id: '1-cat-b',
              },
              {
                id: '2-cat-a',
              },
              {
                id: '2-cat-b',
              },
            ])
            expect(await prisma[categoriesOnPostsModel].findMany({ orderBy: { categoryId: 'asc' } })).toEqual([
              {
                categoryId: '1-cat-a',
                // The update
                postId: '3',
              },
              {
                categoryId: '1-cat-b',
                // The update
                postId: '3',
              },
              {
                categoryId: '2-cat-a',
                postId: '2',
              },
              {
                categoryId: '2-cat-b',
                postId: '2',
              },
            ])
          })

          test('[update] category id should succeed', async () => {
            await prisma[categoryModel].update({
              where: {
                id: '1-cat-a',
              },
              data: {
                id: '1-cat-a-updated',
              },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
              {
                id: '1',
              },
              {
                id: '2',
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                // The update
                id: '1-cat-a-updated',
              },
              {
                id: '1-cat-b',
              },
              {
                id: '2-cat-a',
              },
              {
                id: '2-cat-b',
              },
            ])
            expect(await prisma[categoriesOnPostsModel].findMany({ orderBy: { categoryId: 'asc' } })).toEqual([
              {
                // The update
                categoryId: '1-cat-a-updated',
                postId: '1',
              },
              {
                categoryId: '1-cat-b',
                postId: '1',
              },
              {
                categoryId: '2-cat-a',
                postId: '2',
              },
              {
                categoryId: '2-cat-b',
                postId: '2',
              },
            ])
          })
        })

        describeIf(['Restrict', 'NoAction'].includes(onUpdate))(`onUpdate: ${onUpdate}`, () => {
          test('[update] post id should succeed', async () => {
            await expect(
              prisma[postModel].update({
                where: {
                  id: '1',
                },
                data: {
                  id: '3',
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_postId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `postId`',
              }),
            )
          })

          test('[update] category id should succeed', async () => {
            await expect(
              prisma[categoryModel].update({
                where: {
                  id: '1-cat-a',
                },
                data: {
                  id: '1-cat-a-updated',
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_categoryId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `categoryId`',
              }),
            )
          })
        })

        describeIf(['SetNull', 'SetDefault'].includes(onUpdate))(`onUpdate: ${onUpdate}`, () => {
          test('[update] post id should succeed', async () => {
            await expect(
              prisma[postModel].update({
                where: {
                  id: '1',
                },
                data: {
                  id: '3',
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Null constraint violation on the fields: (`postId`)',
                [Providers.COCKROACHDB]: 'TODO1',
                [Providers.MYSQL]: 'TODO1',
              }),
            )
          })

          test('[update] category id should succeed', async () => {
            await expect(
              prisma[categoryModel].update({
                where: {
                  id: '1-cat-a',
                },
                data: {
                  id: '1-cat-a-updated',
                },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Null constraint violation on the fields: (`categoryId`)',
                [Providers.COCKROACHDB]: 'TODO2',
                [Providers.MYSQL]: 'TODO2',
              }),
            )
          })
        })

        test('[update] categoriesOnPostsModel postId should succeed', async () => {
          await prisma[categoriesOnPostsModel].update({
            where: {
              postId_categoryId: {
                categoryId: '1-cat-a',
                postId: '1',
              },
            },
            data: {
              postId: '2',
            },
          })

          expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
            {
              id: '1',
            },
            {
              id: '2',
            },
          ])
          expect(
            await prisma[categoryModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1-cat-a',
            },
            {
              id: '1-cat-b',
            },
            {
              id: '2-cat-a',
            },
            {
              id: '2-cat-b',
            },
          ])
          expect(await prisma[categoriesOnPostsModel].findMany({ orderBy: { categoryId: 'asc' } })).toEqual([
            {
              categoryId: '1-cat-a',
              // the updated postId
              postId: '2',
            },
            {
              categoryId: '1-cat-b',
              postId: '1',
            },
            {
              categoryId: '2-cat-a',
              postId: '2',
            },
            {
              categoryId: '2-cat-b',
              postId: '2',
            },
          ])
        })
      })

      describe('[delete]', () => {
        beforeEach(async () => {
          await checkIfEmpty(categoryModel, postModel, categoriesOnPostsModel)
          await createXPostsWith2Categories({
            count: 2,
            postModel,
          })
        })

        describeIf(['DEFAULT', 'Restrict', 'NoAction'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          test('[delete] post should throw', async () => {
            await expect(
              prisma[postModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_postId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `postId`',
              }),
            )
          })
          test('[delete] category should throw', async () => {
            await expect(
              prisma[categoryModel].delete({
                where: { id: '1-cat-a' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `CategoriesOnPostsManyToMany_categoryId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `categoryId`',
              }),
            )
          })
        })

        describeIf(['Cascade'].includes(onUpdate))('onDelete: Cascade', () => {
          test('[delete] post should succeed', async () => {
            await prisma[postModel].delete({
              where: { id: '1' },
            })

            expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
              {
                id: '2',
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-cat-a',
              },
              {
                id: '1-cat-b',
              },
              {
                id: '2-cat-a',
              },
              {
                id: '2-cat-b',
              },
            ])
            expect(await prisma[categoriesOnPostsModel].findMany({ orderBy: { categoryId: 'asc' } })).toEqual([
              {
                categoryId: '2-cat-a',
                postId: '2',
              },
              {
                categoryId: '2-cat-b',
                postId: '2',
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
              },
              {
                id: '2',
              },
            ])
            expect(
              await prisma[categoryModel].findMany({
                orderBy: { id: 'asc' },
              }),
            ).toEqual([
              {
                id: '1-cat-b',
              },
              {
                id: '2-cat-a',
              },
              {
                id: '2-cat-b',
              },
            ])
            expect(await prisma[categoriesOnPostsModel].findMany({ orderBy: { categoryId: 'asc' } })).toEqual([
              {
                categoryId: '1-cat-b',
                postId: '1',
              },
              {
                categoryId: '2-cat-a',
                postId: '2',
              },
              {
                categoryId: '2-cat-b',
                postId: '2',
              },
            ])
          })
        })

        // TODO check why SetDefault works because we don't have @default in the schema
        describeIf(['SetNull', 'SetDefault'].includes(onDelete))(`onDelete: ${onDelete}`, () => {
          test('[delete] post should throw', async () => {
            await expect(
              prisma[postModel].delete({
                where: { id: '1' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Null constraint violation on the fields: (`postId`)',
                [Providers.COCKROACHDB]: 'TODO1',
                [Providers.MYSQL]: 'TODO1',
              }),
            )
          })
          test('[delete] category should throw', async () => {
            await expect(
              prisma[categoryModel].delete({
                where: { id: '1-cat-a' },
              }),
            ).rejects.toThrowError(
              // @ts-expect-error: all providers ought to be logged
              conditionalError({
                [Providers.POSTGRESQL]: 'Null constraint violation on the fields: (`categoryId`)',
                [Providers.COCKROACHDB]: 'TODO2',
                [Providers.MYSQL]: 'TODO2',
              }),
            )
          })
        })

        test('[delete] categoriesOnPosts should succeed', async () => {
          await prisma[categoriesOnPostsModel].delete({
            where: {
              postId_categoryId: {
                categoryId: '1-cat-a',
                postId: '1',
              },
            },
          })

          expect(await prisma[postModel].findMany({ orderBy: { id: 'asc' } })).toEqual([
            {
              id: '1',
            },
            {
              id: '2',
            },
          ])
          expect(
            await prisma[categoryModel].findMany({
              orderBy: { id: 'asc' },
            }),
          ).toEqual([
            {
              id: '1-cat-a',
            },
            {
              id: '1-cat-b',
            },
            {
              id: '2-cat-a',
            },
            {
              id: '2-cat-b',
            },
          ])
          expect(await prisma[categoriesOnPostsModel].findMany({ orderBy: { categoryId: 'asc' } })).toEqual([
            {
              categoryId: '1-cat-b',
              postId: '1',
            },
            {
              categoryId: '2-cat-a',
              postId: '2',
            },
            {
              categoryId: '2-cat-b',
              postId: '2',
            },
          ])
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
