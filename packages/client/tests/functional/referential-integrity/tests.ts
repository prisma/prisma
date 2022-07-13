import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'

/* eslint-disable @typescript-eslint/no-unused-vars */

// @ts-ignore
declare let prisma: import('@prisma/client').PrismaClient

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

async function createXUsers({ count, userColumn, profileColumn, userModel, profileModel }) {
  const usersArr: any = []

  for (let i = 0; i < count; i++) {
    // Create 2 users
    const userObj = await prisma[userModel].create({
      data: {
        id: faker.database.mongodbObjectId(),
        [profileColumn]: {
          create: { id: faker.database.mongodbObjectId() },
        },
      },
      include: {
        [profileColumn]: true,
      },
    })
    usersArr.push(userObj)
  }
  return usersArr
}

async function prepare({ count, userColumn, profileColumn, userModel, profileModel }) {
  // Check
  const checkEmpty = await prisma.$transaction([prisma[userModel].findMany(), prisma[profileModel].findMany()])
  expect(checkEmpty[0]).toHaveLength(0)
  expect(checkEmpty[1]).toHaveLength(0)
  // create
  return await createXUsers({
    count,
    userColumn,
    profileColumn,
    userModel,
    profileModel,
  })
}

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

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    


    // - [ ]  **1-to-1** relationship, explicit
    // - [ ]  **1-to-n** relationship, explicit
    // - [ ]  **m-to-n** relationship, explicit

    // we can create a user without a profile, but not a profile without a user
    describe('1:1 mandatory (explicit)', () => {
      const userModel = 'userOneToOne'
      const profileModel = 'profileOneToOne'

      beforeEach(async () => {
        // TODO: consider using something like:
        // await ctx.cli('db', 'push', '--force-reset', '--accept-data-loss', '--schema', 'schema.prisma')
        await prisma.$transaction([prisma[profileModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      afterAll(async () => {
        await prisma.$disconnect()
      })

      test('[create] child with non existing parent should throw', async () => {
        await expect(
          prisma[profileModel].create({
            data: {
              id: '1',
              userId: '1',
            },
          })
        ).rejects.toThrowError('Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)')
      })

      test('[create] child with undefined parent should throw with type error', async () => {
        await expect(
          prisma[profileModel].create({
            data: {
              id: '1',
              userId: undefined, // this would actually be a type-error, but we don't have access to types here
            },
          })
        ).rejects.toThrowError('Argument user for data.user is missing.')
      })

      test('[create] nested [create]', async () => {
        const user1 = await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
          include: { profile: true },
        })
        const user2 = await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
          include: { profile: true },
        })
        const user3 = await prisma[userModel].create({
          data: {
            id: '3',
            profile: {
              create: { id: '3' },
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
        expect(user2).toEqual({
          id: '2',
          profile: {
            id: '2',
            userId: '2',
          },
        })
        expect(user3).toEqual({
          id: '3',
          profile: {
            id: '3',
            userId: '3',
          },
        })

        /**
         * TODO: consider porting the read queries to a transaction.
         */
        const profile1 = await prisma[profileModel].findUniqueOrThrow({
          where: { userId: '1' },
        })
        expect(profile1).toEqual({
          id: '1',
          userId: '1',
        })
        const profile2 = await prisma[profileModel].findUniqueOrThrow({
          where: { userId: '2' },
        })
        expect(profile2).toEqual({
          id: '2',
          userId: '2',
        })
        const profile3 = await prisma[profileModel].findUniqueOrThrow({
          where: { userId: '3' },
        })
        expect(profile3).toEqual({
          id: '3',
          userId: '3',
        })

        const user1Copy = await prisma[userModel].findUniqueOrThrow({
          where: { id: '1' },
        })
        expect(user1Copy).toEqual({
          id: '1',
        })
      })
    
      //
      // TODO more create cases
      //

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

      test('[update] parent id with non-existing id should succeed', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        const user1WithNewId = await prisma[userModel].update({
          where: { id: '1' },
          data: {
            id: '3',
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
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        await expect(
          prisma[userModel].update({
            where: { id: '1' },
            data: {
              id: '2', // existing id
            },
          }),
        ).rejects.toThrowError('Unique constraint failed on the fields: (`id`)')
      })

      test('[update] child id with non-existing id should succeed', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        const profile1WithNewId = await prisma[profileModel].update({
          where: { id: '1' },
          data: {
            id: '3',
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
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        await expect(
          prisma[profileModel].update({
            where: { id: '1' },
            data: {
              id: '2', // existing id
            },
          }),
        ).rejects.toThrowError('Unique constraint failed on the fields: (`id`)')
      })

      test('[updateMany] parent id should succeed', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        await prisma[userModel].updateMany({
          data: { id: '3' },
          where: { id: '1' },
        })

        expect(
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
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        await expect(
          prisma[userModel].updateMany({
            data: { id: '2' }, // existing id
            where: { id: '1' },
          }),
        ).rejects.toThrowError('Unique constraint failed on the fields: (`id`)')
      })

      test("[nested] update parent id [connect] child should succeed if the relationship didn't exist", async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        const user3 = await prisma[userModel].update({
          where: { id: '1' },
          data: {
            id: '3',
            profile: {
              connect: { id: '2' },
            },
          },
        })

        expect(user3).toEqual({
          id: '3',
        })

        expect(
          prisma[profileModel].findUnique({
            where: { userId: '1' },
          }),
        ).resolves.toEqual(null)

        expect(
          prisma[profileModel].findUnique({
            where: { userId: '2' },
          }),
        ).resolves.toEqual(null)

        const profile2 = await prisma[profileModel].findUniqueOrThrow({
          where: { userId: '3' },
        })
        expect(profile2).toEqual({
          id: '2',
          userId: '3',
        })
      })

      test('[nested] [connect] child should succeed if the relationship already existed', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })

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
        ).rejects.toThrowError('The change you are trying to make would violate the required relation \'ProfileOneToOneToUserOneToOne\' between the \`ProfileOneToOne\` and \`UserOneToOne\` models.')
      })

      test('[nested] update parent id [connect] child should succeed if the relationship already existed', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        // TODO: is this a bug? Probably it's trying to disconnect under the hood?
        await expect(
          prisma[userModel].update({
            where: { id: '1' },
            data: {
              id: '3',
              profile: {
                connect: { id: '1' },
              },
            },
          }),
        ).rejects.toThrowError(
          "The change you are trying to make would violate the required relation 'ProfileOneToOneToUserOneToOne' between the `ProfileOneToOne` and `UserOneToOne` models.",
        )
      })

      test('[nested] [disconnect] child should throw', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })

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

      test('[nested] update parent id [update] child should succeed', async () => {
        await prisma[userModel].create({
          data: {
            id: '1',
            profile: {
              create: { id: '1' },
            },
          },
        })
        await prisma[userModel].create({
          data: {
            id: '2',
            profile: {
              create: { id: '2' },
            },
          },
        })

        const user3 = await prisma[userModel].update({
          where: { id: '1' },
          data: {
            id: '3',
            profile: {
              update: {
                id: '3',
              },
            },
          },
          include: { profile: true },
        })
        expect(user3).toEqual({
          id: '3',
          profile: {
            id: '3',
            userId: '3',
          },
        })

        expect(
          prisma[profileModel].findUnique({
            where: { userId: '1' },
          }),
        ).resolves.toEqual(null)

        const profile1FromUser3 = await prisma[profileModel].findUniqueOrThrow({
          where: { userId: '3' },
        })
        expect(profile1FromUser3).toEqual({
          id: '3',
          userId: '3',
        })
      })

      // user.upsert, post.upsert

      // This is ok for 1-to-n and m-to-m
      // test.skip('[nested] update parent id [updateMany] child should succeed', async () => {})

      test.skip('[nested] update parent id [upsert] child should succeed', async () => {})
      test.skip('[upsert] parent id should succeed', async () => {})
      test.skip('[upsert] parent id with existing id should throw', async () => {}) 

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
          }
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
          }
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

      describeIf(suiteConfig.referentialActions.onDelete === '')('onDelete: DEFAULT', () => {
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
            })
          ).rejects.toThrowError('Foreign key constraint failed on the field: `ProfileOneToOne_userId_fkey (index)')
        })
      })

      describeIf(suiteConfig.referentialActions.onDelete === 'Cascade')('onDelete: Cascade', () => {
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
            include: { profile: true }
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

    // testIf(suiteConfig.provider !== 'mongodb')('conditional @ts-test-if', async () => {
    //   // @ts-test-if: provider !== 'mongodb'
    //   await prisma.$queryRaw`SELECT 1;`
    // })
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

// const fkDbErrors = {
//   postgresql: 'Foreign key constraint failed on the field: `ProfileDefault_userId_fkey (index)`',
//   cockroachdb: 'Foreign key constraint failed on the field: `(not available)`',
//   mysql: 'Foreign key constraint failed on the field: `userId`',
//   sqlite: 'Foreign key constraint failed on the field: `foreign key`',
//   mongodb:
//     "The change you are trying to make would violate the required relation 'ProfileDefaultToUserDefault' between the `ProfileDefault` and `UserDefault` models.",
// }
