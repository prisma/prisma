import { copycat } from '@snaplet/copycat'
import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { House, Post, PrismaClient, Property } from './node_modules/@prisma/client'

const email = copycat.email(25)
const title = copycat.words(21)

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
  describe('regular client', () => {
    beforeEach(async () => {
      await prisma.user.deleteMany()
      await prisma.user.create({
        data: {
          email,
          posts: {
            create: {
              title,
              published: true,
            },
          },
        },
      })
    })

    test('lower-cased relations', async () => {
      const data0 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()

      expect(data0).toBe(null)
      expectTypeOf(data0).toBeNullable()
      expectTypeOf(data0?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data0?.houseId).toEqualTypeOf<string | undefined>()

      const data1 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()

      expect(data1).toBe(null)
      expectTypeOf(data1).toBeNullable()
      expectTypeOf(data1?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data1?.likeId).toEqualTypeOf<string | undefined>()

      const data2 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()

      expect(data2).toBe(null)
      expectTypeOf(data2).toBeNullable()
      expectTypeOf(data2?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data2?.userId).toEqualTypeOf<string | undefined>()

      const data3 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()

      expect(data3).toBe(null)
      expectTypeOf(data3).toBeNullable()
      expectTypeOf(data3?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data3?.authorId).toEqualTypeOf<string | undefined | null>()

      const data4 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author()

      expect(data4).toBe(null)
      expectTypeOf(data4).toBeNullable()
      expectTypeOf(data4?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data4?.email).toEqualTypeOf<string | undefined>()

      const data5 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author()
        .property()

      expect(data5).toBe(null)
      expectTypeOf(data5).toBeNullable()
      expectTypeOf(data5?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data5?.houseId).toEqualTypeOf<string | undefined>()
    })

    test('upper-cased relations', async () => {
      const data0 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .Banking()

      expect(data0).toBe(null)
      expectTypeOf(data0).toBeNullable()
      expectTypeOf(data0?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data0?.iban).toEqualTypeOf<string | undefined>()

      const data1 = await prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .Banking()
        .user()

      expect(data1).toBe(null)
      expectTypeOf(data1).toBeNullable()
      expectTypeOf(data1?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data1?.email).toEqualTypeOf<string | undefined>()
    })

    test('findFirst', async () => {
      const posts = await prisma.user
        .findFirst({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[] | null>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('findFirstOrThrow', async () => {
      const posts = await prisma.user
        .findFirstOrThrow({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('findFirstOrThrow where nested entity is not found', async () => {
      const property = await prisma.user
        .findFirstOrThrow({
          where: {
            email,
          },
        })
        .property()

      expectTypeOf(property).toEqualTypeOf<Property | null>()
      expect(property).toBeNull()
    })

    test('findUniqueOrThrow', async () => {
      const posts = await prisma.user
        .findUniqueOrThrow({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('findUniqueOrThrow where nested entity is not found', async () => {
      const property = await prisma.user
        .findUniqueOrThrow({
          where: {
            email,
          },
        })
        .property()

      expectTypeOf(property).toEqualTypeOf<Property | null>()
      expect(property).toBeNull()
    })

    test('create', async () => {
      const posts = await prisma.user
        .create({
          data: {
            email: copycat.email(67),
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([])
    })

    test('update', async () => {
      const posts = await prisma.user
        .update({
          where: {
            email,
          },
          data: {},
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()

      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('upsert', async () => {
      const posts = await prisma.user
        .upsert({
          where: {
            email,
          },
          create: {
            email,
          },
          update: {},
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('delete', async () => {
      const posts = await prisma.user
        .delete({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('chaining and selecting', async () => {
      const posts = await prisma.user
        .findFirst({
          where: {
            email,
          },
        })
        .posts({
          select: {
            title: true,
          },
        })

      expectTypeOf(posts).toBeNullable()
      expectTypeOf(posts).toEqualTypeOf<{ title: string }[] | null>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('chaining and selecting twice', async () => {
      const house = await prisma.user
        .findFirst({
          where: {
            email,
          },
        })
        .property({
          select: {
            houseId: true,
          },
        })
        .house({
          select: {
            likeId: true,
          },
        })

      expectTypeOf(house).toBeNullable()
      expectTypeOf(house).toEqualTypeOf<{ likeId: string } | null>()
      expect(house).toBeNull()
    })
  })

  describe('extended client', () => {
    beforeEach(async () => {
      await prisma.$extends({}).user.deleteMany()
      await prisma.$extends({}).user.create({
        data: {
          email,
          posts: {
            create: {
              title,
              published: true,
            },
          },
        },
      })
    })

    test('lower-cased relations', async () => {
      const data0 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .property()

      expect(data0).toBe(null)
      expectTypeOf(data0).toBeNullable()
      expectTypeOf(data0?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data0?.houseId).toEqualTypeOf<string | undefined>()

      const data1 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()

      expect(data1).toBe(null)
      expectTypeOf(data1).toBeNullable()
      expectTypeOf(data1?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data1?.likeId).toEqualTypeOf<string | undefined>()

      const data2 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()

      expect(data2).toBe(null)
      expectTypeOf(data2).toBeNullable()
      expectTypeOf(data2?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data2?.userId).toEqualTypeOf<string | undefined>()

      const data3 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()

      expect(data3).toBe(null)
      expectTypeOf(data3).toBeNullable()
      expectTypeOf(data3?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data3?.authorId).toEqualTypeOf<string | undefined | null>()

      const data4 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author()

      expect(data4).toBe(null)
      expectTypeOf(data4).toBeNullable()
      expectTypeOf(data4?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data4?.email).toEqualTypeOf<string | undefined>()

      const data5 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author()
        .property()

      expect(data5).toBe(null)
      expectTypeOf(data5).toBeNullable()
      expectTypeOf(data5?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data5?.houseId).toEqualTypeOf<string | undefined>()
    })

    test('upper-cased relations', async () => {
      const data0 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .Banking()

      expect(data0).toBe(null)
      expectTypeOf(data0).toBeNullable()
      expectTypeOf(data0?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data0?.iban).toEqualTypeOf<string | undefined>()

      const data1 = await prisma
        .$extends({})
        .user.findUnique({
          where: {
            email,
          },
        })
        .Banking()
        .user()

      expect(data1).toBe(null)
      expectTypeOf(data1).toBeNullable()
      expectTypeOf(data1?.id).toEqualTypeOf<string | undefined>()
      expectTypeOf(data1?.email).toEqualTypeOf<string | undefined>()
    })

    test('findFirst', async () => {
      const posts = await prisma
        .$extends({})
        .user.findFirst({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[] | null>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('findFirstOrThrow', async () => {
      const posts = await prisma
        .$extends({})
        .user.findFirstOrThrow({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('findFirstOrThrow where nested entity is not found', async () => {
      const property = await prisma
        .$extends({})
        .user.findFirstOrThrow({
          where: {
            email,
          },
        })
        .property()

      expectTypeOf(property).toBeNullable()
      expectTypeOf(property).toEqualTypeOf<Property | null>()
      expect(property).toBeNull()
    })

    test('findUniqueOrThrow', async () => {
      const posts = await prisma
        .$extends({})
        .user.findUniqueOrThrow({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('findUniqueOrThrow where nested entity is not found', async () => {
      const property = await prisma
        .$extends({})
        .user.findUniqueOrThrow({
          where: {
            email,
          },
        })
        .property()

      expectTypeOf(property).toBeNullable()
      expectTypeOf(property).toEqualTypeOf<Property | null>()
      expect(property).toBeNull()
    })

    test('create', async () => {
      const posts = await prisma
        .$extends({})
        .user.create({
          data: {
            email: copycat.email(53),
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([])
    })

    test('update', async () => {
      const posts = await prisma
        .$extends({})
        .user.update({
          where: {
            email,
          },
          data: {},
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()

      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('upsert', async () => {
      const posts = await prisma
        .$extends({})
        .user.upsert({
          where: {
            email,
          },
          create: {
            email,
          },
          update: {},
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('delete', async () => {
      const posts = await prisma
        .$extends({})
        .user.delete({
          where: {
            email,
          },
        })
        .posts()

      expectTypeOf(posts).toEqualTypeOf<Post[]>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('chaining and selecting', async () => {
      const posts = await prisma
        .$extends({})
        .user.findFirst({
          where: {
            email,
          },
        })
        .posts({
          select: {
            title: true,
          },
        })

      expectTypeOf(posts).toBeNullable()
      expectTypeOf(posts).toEqualTypeOf<{ title: string }[] | null>()
      expect(posts).toEqual([expect.objectContaining({ title })])
    })

    test('chaining and selecting twice', async () => {
      const posts = await prisma
        .$extends({})
        .user.findFirst({
          where: {
            email,
          },
        })
        .property({
          select: {
            houseId: true,
          },
        })
        .house({
          select: {
            likeId: true,
          },
        })

      expectTypeOf(posts).toBeNullable()
      expectTypeOf(posts).toEqualTypeOf<{ likeId: string } | null>()
      expect(posts).toBeNull()
    })

    test('findUniqueOrThrow with required to-one relation', () => {
      const result = prisma.property
        .findUniqueOrThrow({
          where: {
            id: '123',
          },
        })
        .house()

      expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<House>()
    })

    test('findFirstOrThrow with required to-one relation', () => {
      const result = prisma.property
        .findUniqueOrThrow({
          where: {
            id: '123',
          },
        })
        .house()

      expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<House>()
    })

    test('findUniqueOrThrow with required to-one relation circling back to optional relation', () => {
      const result = prisma.property
        .findUniqueOrThrow({
          where: {
            id: '123',
          },
        })
        .house()
        .like()
        .user()
        .property()

      expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<Property | null>()
    })

    test('findFirstOrThrow with required to-one relation circling back to optional relation', () => {
      const result = prisma.property
        .findUniqueOrThrow({
          where: {
            id: '123',
          },
        })
        .house()
        .like()
        .user()
        .property()

      expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<Property | null>()
    })
  })

  test('findUniqueOrThrow with required to-one relation', () => {
    const result = prisma
      .$extends({})
      .property.findUniqueOrThrow({
        where: {
          id: '123',
        },
      })
      .house()

    expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<House>()
  })

  test('findFirstOrThrow with required to-one relation', () => {
    const result = prisma
      .$extends({})
      .property.findUniqueOrThrow({
        where: {
          id: '123',
        },
      })
      .house()

    expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<House>()
  })

  test('findUniqueOrThrow with required to-one relation circling back to optional relation', () => {
    const result = prisma
      .$extends({})
      .property.findUniqueOrThrow({
        where: {
          id: '123',
        },
      })
      .house()
      .like()
      .user()
      .property()

    expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<Property | null>()
  })

  test('findFirstOrThrow with required to-one relation circling back to optional relation', () => {
    const result = prisma
      .$extends({})
      .property.findUniqueOrThrow({
        where: {
          id: '123',
        },
      })
      .house()
      .like()
      .user()
      .property()

    expectTypeOf<Awaited<typeof result>>().toEqualTypeOf<Property | null>()
  })
})
