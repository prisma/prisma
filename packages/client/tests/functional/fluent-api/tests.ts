import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

const email = faker.internet.email()
const title = faker.lorem.sentence()

declare let prisma: PrismaClient

testMatrix.setupTestSuite(() => {
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
    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property(),
    ).resolves.toBe(null)

    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house(),
    ).resolves.toBe(null)

    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like(),
    ).resolves.toBe(null)

    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post(),
    ).resolves.toBe(null)

    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .property()
        .house()
        .like()
        .post()
        .author(),
    ).resolves.toBe(null)

    await expect(
      prisma.user
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
        .property(),
    ).resolves.toBe(null)
  })

  test('upper-cased relations', async () => {
    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .Banking(),
    ).resolves.toBe(null)

    await expect(
      prisma.user
        .findUnique({
          where: {
            email,
          },
        })
        .Banking()
        .user(),
    ).resolves.toBe(null)
  })

  test('findFirst', async () => {
    const posts = await prisma.user
      .findFirst({
        where: {
          email,
        },
      })
      .posts()

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

    expect(property).toBeNull()
  })

  test('create', async () => {
    const posts = await prisma.user
      .create({
        data: {
          email: faker.internet.email(),
        },
      })
      .posts()

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

    expect(posts).toEqual([expect.objectContaining({ title })])
  })
})
