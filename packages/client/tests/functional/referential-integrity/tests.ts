import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

/* eslint-disable @typescript-eslint/no-unused-vars */

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
    describe('1:1 optional (default)', () => {
      const c = {
        // Always create n+1 for the safety check at the end
        // So we know nothing unentended happened
        count: 2,
        userColumn: 'user',
        profileColumn: 'profile',
        userModel: `userDefault`,
        profileModel: `profileDefault`,
      }

      beforeEach(async () => {
        await prisma.$transaction([prisma[c.profileModel].deleteMany(), prisma[c.userModel].deleteMany()])
      })

      test('[create] parent and [connect] child with non-existing id should throw', async () => {
        const usersArr = await prepare(c)
        const randomId = faker.database.mongodbObjectId()

        await expect(
          prisma[c.userModel].create({
            data: {
              id: faker.database.mongodbObjectId(),
              [c.profileColumn]: {
                connect: { id: randomId },
              },
            },
          }),
        ).rejects.toThrowError(
          `An operation failed because it depends on one or more records that were required but not found. No 'ProfileDefault' record to connect was found was found for a nested connect on one-to-one relation 'ProfileDefaultToUserDefault'.`,
        )

        await checkForNoChange({
          ...c,
          usersArr,
        })
      })

      test('[create] child and [connect] parent with non-existing id should throw', async () => {
        const usersArr = await prepare(c)
        const randomId = faker.database.mongodbObjectId()

        await expect(
          prisma[c.profileModel].create({
            data: {
              id: faker.database.mongodbObjectId(),
              [c.userColumn]: {
                connect: { id: randomId },
              },
            },
          }),
        ).rejects.toThrowError(
          `An operation failed because it depends on one or more records that were required but not found. No 'UserDefault' record (needed to inline connect on create for 'ProfileDefault' record) was found for a nested connect on one-to-one relation 'ProfileDefaultToUserDefault'.`,
        )

        await checkForNoChange({
          ...c,
          usersArr,
        })
      })

      const fkDbErrors = {
        postgresql: 'Foreign key constraint failed on the field: `ProfileDefault_userId_fkey (index)`',
        cockroachdb: 'Foreign key constraint failed on the field: `(not available)`',
        mysql: 'Foreign key constraint failed on the field: `userId`',
        sqlite: 'Foreign key constraint failed on the field: `foreign key`',
        mongodb:
          "The change you are trying to make would violate the required relation 'ProfileDefaultToUserDefault' between the `ProfileDefault` and `UserDefault` models.",
      }
      // Note: Does not throw if RI = prisma
      test('[create] child with non-existing parent id should throw', async () => {
        const usersArr = await prepare(c)

        await expect(
          prisma[c.profileModel].create({
            data: {
              id: faker.database.mongodbObjectId(),
              userId: faker.database.mongodbObjectId(),
            },
          }),
        ).rejects.toThrowError(fkDbErrors[suiteConfig.provider])

        await checkForNoChange({
          ...c,
          usersArr,
        })
      })
      // Note: Does not throw if RI = prisma
      test('[update] child with non-existing parent id should throw', async () => {
        const usersArr = await prepare(c)

        await expect(
          prisma[c.profileModel].update({
            where: { id: usersArr[0].profile.id },
            data: {
              userId: faker.database.mongodbObjectId(),
            },
          }),
        ).rejects.toThrowError(fkDbErrors[suiteConfig.provider])

        await checkForNoChange({
          ...c,
          usersArr,
        })
      })
      // Note: Does not throw if RI = prisma
      test('[delete] parent should throw', async () => {
        const usersArr = await prepare(c)

        await expect(
          prisma[c.userModel].delete({
            where: {
              id: usersArr[0].id,
            },
          }),
        ).rejects.toThrowError(fkDbErrors[suiteConfig.provider])

        await checkForNoChange({
          ...c,
          usersArr,
        })
      })

      test('[delete] child should suceed', async () => {
        const usersArr = await prepare(c)

        expect(
          await prisma[c.profileModel].delete({
            where: {
              id: usersArr[0].profile.id,
            },
          }),
        ).toBeTruthy()

        const [findManyUserById1, findManyProfileById1] = await prisma.$transaction([
          prisma[c.userModel].findMany({
            include: {
              [c.profileColumn]: true,
            },
          }),
          prisma[c.profileModel].findMany({}),
        ])
        expect(findManyUserById1).toHaveLength(c.count)
        expect(findManyProfileById1).toHaveLength(c.count - 1)
        const expected = sortArrayById([{ id: usersArr[0].id, [c.profileColumn]: null }, usersArr[1]])
        expect(sortArrayById(findManyUserById1)).toMatchObject(expected)
      })
    })

    describe('1:1 optional (Cascade)', () => {
      const c = {
        // Always create n+1 for the safety check at the end
        // So we know nothing unentended happened
        count: 2,
        userColumn: 'user',
        profileColumn: 'profile',
        userModel: `userCascade`,
        profileModel: `profileCascade`,
      }

      beforeEach(async () => {
        await prisma.$transaction([prisma[c.profileModel].deleteMany(), prisma[c.userModel].deleteMany()])
      })

      test('[update] parent id should cascade and update child', async () => {
        const usersArr = await prepare(c)
        const randomId = faker.database.mongodbObjectId()

        /*
        Errors on MongoDB with
          232 // Update
          233 expect(
        → 234   await prisma[c.userModel].update({
                  where: {
                    id: '6ecaec17dae205ceeadad25e'
                  },
                  data: {
                    id: 'defc1e1e9d36d8d906ecda1c'
                    ~~
                  }
                })

        Unknown arg `id` in data.id for type UserCascadeUpdateInput. Available args:

        type UserCascadeUpdateInput {
          profile?: ProfileCascadeUpdateOneWithoutUserNestedInput
        }
        */
        // Update
        expect(
          await prisma[c.userModel].update({
            where: {
              id: usersArr[0].id,
            },
            data: {
              id: randomId,
            },
          }),
        ).toMatchObject({ id: randomId })

        const [findManyUserById1, findManyProfileById1] = await prisma.$transaction([
          prisma[c.userModel].findMany({
            include: {
              [c.profileColumn]: true,
            },
          }),
          prisma[c.profileModel].findMany({}),
        ])
        expect(findManyUserById1).toHaveLength(c.count)
        expect(findManyProfileById1).toHaveLength(c.count)
        const expected = sortArrayById([
          {
            id: randomId,
            [c.profileColumn]: {
              id: usersArr[0].profile.id,
              userId: randomId,
            },
          },
          usersArr[1],
        ])
        expect(sortArrayById(findManyUserById1)).toMatchObject(expected)
      })

      test('[delete] parent should cascade and delete child', async () => {
        const usersArr = await prepare(c)

        // Update
        expect(
          await prisma[c.userModel].delete({
            where: {
              id: usersArr[0].id,
            },
          }),
        ).toMatchObject({ id: usersArr[0].id })

        const [findManyUserById1, findManyProfileById1] = await prisma.$transaction([
          prisma[c.userModel].findMany({
            include: {
              [c.profileColumn]: true,
            },
          }),
          prisma[c.profileModel].findMany({}),
        ])
        expect(findManyUserById1).toHaveLength(c.count - 1)
        expect(findManyProfileById1).toHaveLength(c.count - 1)
        expect(sortArrayById(findManyUserById1)).toMatchObject(sortArrayById([usersArr[1]]))
      })

      /*
        // const deleteRaw = await prisma.$executeRaw`DELETE FROM "UserCascade" WHERE id = ${userId}`
        // const deleteRaw = await prisma.$executeRaw`DELETE FROM "ProfileCascade" WHERE id = ${profileId}`
        // console.log({ deleteRaw })
      */
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
