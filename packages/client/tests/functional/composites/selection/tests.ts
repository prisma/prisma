import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import { PrismaClient, Profile, User } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      await prisma.user.create({
        data: {
          profile: {
            name: {
              firstName: 'Horsey',
              lastName: 'McHorseFace',
            },
            url: 'https://horsey.example.com',
          },
        },
      })
    })

    test('composites are selected by default', async () => {
      const user = await prisma.user.findFirstOrThrow()
      expect(user).toHaveProperty('profile')
      expect(user.profile).toHaveProperty('url')
      expect(user.profile).toHaveProperty('name')

      expectTypeOf(user).toHaveProperty('profile')
      expectTypeOf(user.profile).toHaveProperty('url')
      expectTypeOf(user.profile).toHaveProperty('name')
    })

    test('composites can be selected explicitly', async () => {
      const user = await prisma.user.findFirstOrThrow({
        select: {
          profile: true,
        },
      })
      expect(user).toHaveProperty('profile')
      expect(user.profile).toHaveProperty('url')
      expect(user.profile).toHaveProperty('name')

      expectTypeOf(user).toHaveProperty('profile')
      expectTypeOf(user.profile).toHaveProperty('url')
      expectTypeOf(user.profile).toHaveProperty('name')
    })

    test('composites can be selected explicitly on multiple nesting levels', async () => {
      const user = await prisma.user.findFirstOrThrow({
        select: {
          profile: {
            select: {
              name: {
                select: {
                  firstName: true,
                },
              },
            },
          },
        },
      })
      expect(user).toHaveProperty('profile')
      expect(user.profile).not.toHaveProperty('url')
      expect(user.profile).toHaveProperty('name')
      expect(user.profile.name).toHaveProperty('firstName')
      expect(user.profile.name).not.toHaveProperty('lastName')

      expectTypeOf(user).toHaveProperty('profile')
      expectTypeOf(user.profile).not.toHaveProperty('url')
      expectTypeOf(user.profile).toHaveProperty('name')
      expectTypeOf(user.profile.name).toHaveProperty('firstName')
      expectTypeOf(user.profile.name).not.toHaveProperty('lastName')
    })

    test('composites are included on default types', () => {
      expectTypeOf<User>().toHaveProperty('profile')
      expectTypeOf<Profile>().toHaveProperty('name')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'cockroachdb', 'sqlserver'],
      reason: 'composites are mongo-only feature',
    },
  },
)
