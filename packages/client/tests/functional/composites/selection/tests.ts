import { expectTypeOf } from 'expect-type'

import { Providers } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient, Profile, User } from './node_modules/@prisma/client'

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
            favoriteThings: [{ name: 'Horsing around at the speed of sound' }],
          },
        },
      })
    })

    test('composites are selected by default', async () => {
      const user = await prisma.user.findFirstOrThrow()
      expect(user).toHaveProperty('profile')
      expect(user.profile).toHaveProperty('url')
      expect(user.profile).toHaveProperty('name')
      expect(user.profile).toHaveProperty('favoriteThings')

      expectTypeOf(user).toHaveProperty('profile')
      expectTypeOf(user.profile).toHaveProperty('url')
      expectTypeOf(user.profile).toHaveProperty('name')
      expectTypeOf(user.profile.name).not.toBeNullable()
      expectTypeOf(user.profile).toHaveProperty('alternateName')
      expectTypeOf(user.profile.alternateName).toMatchTypeOf<{ firstName: string; lastName: string } | null>()
      expectTypeOf(user.profile).toHaveProperty('favoriteThings')
      expectTypeOf(user.profile.favoriteThings).toMatchTypeOf<Array<{ name: string }>>()
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
      expect(user.profile).toHaveProperty('favoriteThings')

      expectTypeOf(user).toHaveProperty('profile')
      expectTypeOf(user.profile).toHaveProperty('url')
      expectTypeOf(user.profile).toHaveProperty('name')
      expectTypeOf(user.profile.name).not.toBeNullable()
      expectTypeOf(user.profile).toHaveProperty('alternateName')
      expectTypeOf(user.profile.alternateName).toMatchTypeOf<{ firstName: string; lastName: string } | null>()
      expectTypeOf(user.profile).toHaveProperty('favoriteThings')
      expectTypeOf(user.profile.favoriteThings).toMatchTypeOf<Array<{ name: string }>>()
    })

    test('composites can be selected explicitly on multiple nesting levels', async () => {
      const user = await prisma.user.findFirstOrThrow({
        select: {
          profile: {
            select: {
              favoriteThings: true,
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

      expectTypeOf(user.profile).toHaveProperty('favoriteThings')
      expectTypeOf(user.profile.favoriteThings).toMatchTypeOf<Array<{ name: string }>>()
    })

    test('composites are included on default types', () => {
      expectTypeOf<User>().toHaveProperty('profile')
      expectTypeOf<Profile>().toHaveProperty('name')
      expectTypeOf<Profile>().toHaveProperty('alternateName')
      expectTypeOf<Profile['alternateName']>().toMatchTypeOf<{ firstName: string; lastName: string } | null>()
      expectTypeOf<Profile>().toHaveProperty('favoriteThings')
      expectTypeOf<Profile['favoriteThings']>().toMatchTypeOf<Array<{ name: string }>>()
    })
  },
  {
    optOut: {
      from: [Providers.SQLSERVER, Providers.MYSQL, Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.SQLITE],
      reason: 'composites are mongo-only feature',
    },
  },
)
