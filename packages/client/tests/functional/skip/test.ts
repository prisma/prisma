import { expectTypeOf } from 'expect-type'

import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          name: 'Boaty McBoatface',
          email: 'boat@example.com',
        },
        {
          name: 'Horsey McHorseFace',
          email: 'horse@example.com',
        },
      ],
    })
  })

  test('skips arguments', async () => {
    const result = await prisma.user.findMany({
      where: Prisma.skip,
      orderBy: { name: 'asc' },
    })

    expect(result).toMatchInlineSnapshot(
      [{ id: expect.any(String) }, { id: expect.any(String) }],
      `
      [
        {
          "email": "boat@example.com",
          "id": Any<String>,
          "name": "Boaty McBoatface",
        },
        {
          "email": "horse@example.com",
          "id": Any<String>,
          "name": "Horsey McHorseFace",
        },
      ]
    `,
    )
  })

  test('skips input fields', async () => {
    const result = await prisma.user.findMany({
      where: {
        name: Prisma.skip,
      },
      orderBy: { name: 'asc' },
    })

    expect(result).toMatchInlineSnapshot(
      [{ id: expect.any(String) }, { id: expect.any(String) }],
      `
      [
        {
          "email": "boat@example.com",
          "id": Any<String>,
          "name": "Boaty McBoatface",
        },
        {
          "email": "horse@example.com",
          "id": Any<String>,
          "name": "Horsey McHorseFace",
        },
      ]
    `,
    )
  })

  test('skips relations in include', async () => {
    const result = await prisma.user.findFirstOrThrow({
      include: {
        posts: Prisma.skip,
      },
    })

    expect(result).not.toHaveProperty('posts')
    expectTypeOf(result).not.toHaveProperty('posts')
  })

  test('skips relations in select', async () => {
    const result = await prisma.user.findFirstOrThrow({
      select: {
        id: true,
        posts: Prisma.skip,
      },
    })

    expect(result).not.toHaveProperty('posts')
    expectTypeOf(result).not.toHaveProperty('posts')
  })

  test('skips fields in omit', async () => {
    const result = await prisma.user.findFirstOrThrow({
      omit: {
        email: Prisma.skip,
      },
    })

    expect(result).toHaveProperty('email')
    expectTypeOf(result).toHaveProperty('email')
  })

  describe('after extension', () => {
    test('skips relations in include', async () => {
      const result = await prisma.$extends({}).user.findFirstOrThrow({
        include: {
          posts: Prisma.skip,
        },
      })

      expect(result).not.toHaveProperty('posts')
      expectTypeOf(result).not.toHaveProperty('posts')
    })

    test('skips relations in select', async () => {
      const result = await prisma.$extends({}).user.findFirstOrThrow({
        select: {
          id: true,
          posts: Prisma.skip,
        },
      })

      expect(result).not.toHaveProperty('posts')
      expectTypeOf(result).not.toHaveProperty('posts')
    })

    test('skips fields in omit', async () => {
      const result = await prisma.$extends({}).user.findFirstOrThrow({
        omit: {
          email: Prisma.skip,
        },
      })

      expect(result).toHaveProperty('email')
      expectTypeOf(result).toHaveProperty('email')
    })
  })
})
