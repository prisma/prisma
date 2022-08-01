import { checkIfEmpty } from '../referential-integrity/_utils'
import { ConditionalError } from '../_referential-integrity-utils/conditionalError'
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

testMatrix.setupTestSuite(
  (suiteConfig, suiteMeta) => {
    const conditionalError = ConditionalError
      .new()
      .with('provider', suiteConfig.provider)
       // @ts-ignore
      .with('referentialIntegrity', suiteConfig.referentialIntegrity || 'foreignKeys')

    const { onDelete } = suiteConfig.referentialActions
    const { onUpdate } = suiteConfig.referentialActions

    /**
     * 1:1 relation
     * - we can create a user without a profile, but not a profile without a user
     */

    describe('1:1 mandatory (explicit)', () => {
      const userModel = 'user'
      const profileModel = 'profile'
      const profileColumn = 'profile'

      beforeEach(async () => {
        await prisma.$transaction([prisma[profileModel].deleteMany(), prisma[userModel].deleteMany()])
      })

      describe('[create]', () => {
        test('[create] child with non existing parent should throw', async () => {
          await expect(
            prisma[profileModel].create({
              data: {
                id: '1',
                userId: '1',
              },
            }),
          ).rejects.toThrowError(
            conditionalError.snapshot({
              foreignKeys: {
                [Providers.POSTGRESQL]:
                  'Foreign key constraint failed on the field: `Profile_userId_fkey (index)`',
                [Providers.COCKROACHDB]: 'Foreign key constraint failed on the field: `(not available)`',
                [Providers.MYSQL]: 'Foreign key constraint failed on the field: `userId`',
                [Providers.SQLSERVER]:
                  'Foreign key constraint failed on the field: `Profile_userId_fkey (index)`',
                [Providers.SQLITE]:
                  'Foreign key constraint failed on the field: `foreign key`',
              },
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
          await prisma[userModel].create({
            data: {
              id: '1',
              profile: {
                create: { id: '1' },
              },
            },
          })

          const user1Copy = await prisma[userModel].findUniqueOrThrow({
            where: { id: '1' },
          })
          expect(user1Copy).toEqual({
            id: '1',
            enabled: null,
          })
          const profile1 = await prisma[profileModel].findUniqueOrThrow({
            where: { userId: '1' },
          })
          expect(profile1).toEqual({
            id: '1',
            userId: '1',
            enabled: null,
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
