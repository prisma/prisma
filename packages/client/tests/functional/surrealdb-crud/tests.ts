import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.post.deleteMany()
      await prisma.user.deleteMany()
    })

    test('create a single user', async () => {
      const user = await prisma.user.create({
        data: { email: 'create-single@test.com', name: 'Alice', age: 30 },
      })
      expect(user.email).toBe('create-single@test.com')
      expect(user.name).toBe('Alice')
      expect(user.age).toBe(30)
      expect(user.id).toBeTruthy()
    })

    test('create a user with a related post', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'create-rel@test.com',
          name: 'Bob',
          posts: {
            create: { title: 'Hello SurrealDB', content: 'First post', published: true },
          },
        },
        include: { posts: true },
      })
      expect(user.posts).toHaveLength(1)
      expect(user.posts[0].title).toBe('Hello SurrealDB')
      expect(user.posts[0].published).toBe(true)
    })

    test('findMany returns all users', async () => {
      await prisma.user.create({ data: { email: 'fm-a@test.com', name: 'A' } })
      await prisma.user.create({ data: { email: 'fm-b@test.com', name: 'B' } })

      const users = await prisma.user.findMany({ orderBy: { email: 'asc' } })
      expect(users).toHaveLength(2)
    })

    test('findUnique by email', async () => {
      await prisma.user.create({ data: { email: 'fu@test.com', name: 'FindMe' } })

      const user = await prisma.user.findUnique({ where: { email: 'fu@test.com' } })
      expect(user).not.toBeNull()
      expect(user?.name).toBe('FindMe')
    })

    test('findFirst with where clause', async () => {
      await prisma.user.create({ data: { email: 'ff@test.com', name: 'Old', age: 50 } })

      const user = await prisma.user.findFirst({ where: { age: { gt: 20 } } })
      expect(user).not.toBeNull()
      expect(user?.age).toBeGreaterThan(20)
    })

    test('findMany with include (relations)', async () => {
      await prisma.user.create({
        data: {
          email: 'incl@test.com',
          name: 'WithPost',
          posts: { create: { title: 'Included' } },
        },
      })

      const users = await prisma.user.findMany({
        where: { email: 'incl@test.com' },
        include: { posts: true },
      })
      expect(users).toHaveLength(1)
      expect(users[0].posts.length).toBeGreaterThanOrEqual(1)
    })

    test('findMany with select', async () => {
      await prisma.user.create({ data: { email: 'sel@test.com', name: 'Sel', age: 10 } })

      const users = await prisma.user.findMany({
        select: { email: true, name: true },
        where: { email: 'sel@test.com' },
      })
      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('sel@test.com')
      expect((users[0] as any).age).toBeUndefined()
    })

    test('update a single user', async () => {
      await prisma.user.create({ data: { email: 'upd@test.com', name: 'Before', age: 30 } })

      const updated = await prisma.user.update({
        where: { email: 'upd@test.com' },
        data: { name: 'After', age: 31 },
      })
      expect(updated.name).toBe('After')
      expect(updated.age).toBe(31)
    })

    test('updateMany', async () => {
      await prisma.user.create({ data: { email: 'um1@test.com', age: 40 } })
      await prisma.user.create({ data: { email: 'um2@test.com', age: 50 } })

      const result = await prisma.user.updateMany({
        where: { age: { gte: 40 } },
        data: { age: 99 },
      })
      expect(result.count).toBe(2)
    })

    test('upsert - update existing', async () => {
      await prisma.user.create({ data: { email: 'ups-exist@test.com', name: 'Old' } })

      const user = await prisma.user.upsert({
        where: { email: 'ups-exist@test.com' },
        update: { name: 'Upserted' },
        create: { email: 'ups-exist@test.com', name: 'New' },
      })
      expect(user.name).toBe('Upserted')
    })

    test('upsert - create new', async () => {
      const user = await prisma.user.upsert({
        where: { email: 'ups-new@test.com' },
        update: { name: 'Updated' },
        create: { email: 'ups-new@test.com', name: 'Created', age: 25 },
      })
      expect(user.name).toBe('Created')
    })

    test('delete a single user', async () => {
      await prisma.user.create({ data: { email: 'del@test.com', name: 'ToDelete' } })

      const deleted = await prisma.user.delete({ where: { email: 'del@test.com' } })
      expect(deleted.email).toBe('del@test.com')
    })

    test('deleteMany', async () => {
      await prisma.user.create({ data: { email: 'dm1@test.com' } })
      await prisma.user.create({ data: { email: 'dm2@test.com' } })

      const result = await prisma.user.deleteMany({
        where: { email: { contains: 'dm' } },
      })
      expect(result.count).toBe(2)
    })

    test('count users', async () => {
      await prisma.user.create({ data: { email: 'cnt1@test.com' } })
      await prisma.user.create({ data: { email: 'cnt2@test.com' } })

      const count = await prisma.user.count()
      expect(count).toBe(2)
    })

    test('aggregate - avg, min, max', async () => {
      await prisma.user.create({ data: { email: 'agg1@test.com', age: 20 } })
      await prisma.user.create({ data: { email: 'agg2@test.com', age: 40 } })

      const result = await prisma.user.aggregate({
        _avg: { age: true },
        _min: { age: true },
        _max: { age: true },
      })
      expect(result._avg.age).toBe(30)
      expect(result._min.age).toBe(20)
      expect(result._max.age).toBe(40)
    })

    test('interactive transaction', async () => {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: 'tx@test.com', name: 'TX User' },
        })
        return tx.user.findUnique({ where: { id: user.id } })
      })
      expect(result?.name).toBe('TX User')
    })

    test('where - contains filter', async () => {
      await prisma.user.create({ data: { email: 'contains@test.com' } })

      const users = await prisma.user.findMany({
        where: { email: { contains: 'contains' } },
      })
      expect(users).toHaveLength(1)
    })

    test('where - startsWith filter', async () => {
      await prisma.user.create({ data: { email: 'starts-with@test.com' } })

      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'starts' } },
      })
      expect(users).toHaveLength(1)
    })

    test('where - in filter', async () => {
      await prisma.user.create({ data: { email: 'in1@test.com' } })
      await prisma.user.create({ data: { email: 'in2@test.com' } })
      await prisma.user.create({ data: { email: 'in3@test.com' } })

      const users = await prisma.user.findMany({
        where: { email: { in: ['in1@test.com', 'in2@test.com'] } },
      })
      expect(users).toHaveLength(2)
    })

    test('where - NOT filter', async () => {
      await prisma.user.create({ data: { email: 'not-a@test.com' } })
      await prisma.user.create({ data: { email: 'not-b@test.com' } })

      const users = await prisma.user.findMany({
        where: { NOT: { email: 'not-a@test.com' } },
      })
      expect(users.every((u) => u.email !== 'not-a@test.com')).toBe(true)
    })

    test('orderBy ascending', async () => {
      await prisma.user.create({ data: { email: 'z@test.com' } })
      await prisma.user.create({ data: { email: 'a@test.com' } })

      const users = await prisma.user.findMany({ orderBy: { email: 'asc' } })
      expect(users[0].email).toBe('a@test.com')
      expect(users[1].email).toBe('z@test.com')
    })

    test('orderBy descending', async () => {
      await prisma.user.create({ data: { email: 'z@test.com' } })
      await prisma.user.create({ data: { email: 'a@test.com' } })

      const users = await prisma.user.findMany({ orderBy: { email: 'desc' } })
      expect(users[0].email).toBe('z@test.com')
      expect(users[1].email).toBe('a@test.com')
    })

    test('take and skip (pagination)', async () => {
      await prisma.user.create({ data: { email: 'page1@test.com' } })
      await prisma.user.create({ data: { email: 'page2@test.com' } })
      await prisma.user.create({ data: { email: 'page3@test.com' } })

      const page = await prisma.user.findMany({
        take: 1,
        skip: 1,
        orderBy: { email: 'asc' },
      })
      expect(page).toHaveLength(1)
      expect(page[0].email).toBe('page2@test.com')
    })

    test('create with null optional field', async () => {
      const user = await prisma.user.create({
        data: { email: 'nullable@test.com', name: null },
      })
      expect(user.name).toBeNull()
    })

    test('filter by null', async () => {
      await prisma.user.create({ data: { email: 'hasnull@test.com' } })
      await prisma.user.create({ data: { email: 'hasname@test.com', name: 'HasName' } })

      const users = await prisma.user.findMany({ where: { name: null } })
      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('hasnull@test.com')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'SurrealDB-only test suite',
    },
  },
)
