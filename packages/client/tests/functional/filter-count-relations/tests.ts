import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

const email = faker.internet.email()
const title = faker.lorem.sentence()

testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    const { id: groupId } = await prisma.group.create({
      data: { title },
    })

    await prisma.user.create({
      data: {
        email: faker.internet.email(),
        blocked: true,
        balance: 50,
        groups: { connect: { id: groupId } },
      },
    })

    await prisma.user.create({
      data: {
        email: faker.internet.email(),
        balance: 10,
        groups: { connect: { id: groupId } },
      },
    })

    const { id: authorId } = await prisma.user.create({
      data: {
        email,
        balance: 70,
        groups: { connect: { id: groupId } },
      },
    })

    await prisma.post.create({ data: { published: true, upvotes: 10, authorId } })
    await prisma.post.create({ data: { published: true, upvotes: 150, authorId } })
    await prisma.post.create({ data: { published: false, upvotes: 120, authorId } })
    await prisma.post.create({ data: { published: true, upvotes: 15, authorId } })
  })

  test('without condition', async () => {
    const user = await prisma.user.findFirst({ where: { email }, select: { _count: { select: { posts: true } } } })

    expect(user?._count.posts).toBe(4)
  })

  describe('one-to-many', () => {
    test('with simple equality condition', async () => {
      const user = await prisma.user.findFirst({
        where: { email },
        select: { _count: { select: { posts: { where: { published: true } } } } },
      })

      expect(user?._count.posts).toBe(3)
    })

    test('with > condition', async () => {
      const user = await prisma.user.findFirst({
        where: { email },
        select: { _count: { select: { posts: { where: { upvotes: { gt: 100 } } } } } },
      })

      expect(user?._count.posts).toBe(2)
    })

    test('with multiple conditions', async () => {
      const user = await prisma.user.findFirst({
        where: { email },
        select: { _count: { select: { posts: { where: { published: true, upvotes: { gt: 100 } } } } } },
      })

      expect(user?._count.posts).toBe(1)
    })
  })

  describe('many-to-many', () => {
    test('with simple equality condition', async () => {
      const group = await prisma.group.findFirst({
        where: { title },
        select: { _count: { select: { users: { where: { blocked: true } } } } },
      })

      expect(group?._count.users).toBe(1)
    })

    test('with > condition', async () => {
      const group = await prisma.group.findFirst({
        where: { title },
        select: { _count: { select: { users: { where: { balance: { gt: 20 } } } } } },
      })

      expect(group?._count.users).toBe(2)
    })

    test('with multiple conditions', async () => {
      const group = await prisma.group.findFirst({
        where: { title },
        select: { _count: { select: { users: { where: { balance: { gt: 20 }, blocked: false } } } } },
      })
      expect(group?._count.users).toBe(1)
    })
  })

  test('nested relation', async () => {
    const group = await prisma.group.findFirst({
      where: { title },
      select: {
        users: {
          select: {
            _count: { select: { posts: { where: { published: true } } } },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    })

    expect(group?.users).toEqual([{ _count: { posts: 0 } }, { _count: { posts: 0 } }, { _count: { posts: 3 } }])
  })
})
