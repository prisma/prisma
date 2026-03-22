import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    // ============================================================
    // CREATE
    // ============================================================

    test('create a single user', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'alice@surrealdb.com',
          name: 'Alice',
          age: 30,
        },
      })

      expect(user.email).toBe('alice@surrealdb.com')
      expect(user.name).toBe('Alice')
      expect(user.age).toBe(30)
      expect(user.id).toBeTruthy()
    })

    test('create a user with a related post', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'bob@surrealdb.com',
          name: 'Bob',
          posts: {
            create: {
              title: 'Hello SurrealDB',
              content: 'First post from SurrealDB adapter',
              published: true,
            },
          },
        },
        include: { posts: true },
      })

      expect(user.name).toBe('Bob')
      expect(user.posts).toHaveLength(1)
      expect(user.posts[0].title).toBe('Hello SurrealDB')
      expect(user.posts[0].published).toBe(true)
    })

    // ============================================================
    // READ
    // ============================================================

    test('findMany returns all users', async () => {
      const users = await prisma.user.findMany({
        orderBy: { email: 'asc' },
      })

      expect(users.length).toBeGreaterThanOrEqual(2)
    })

    test('findUnique by email', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'alice@surrealdb.com' },
      })

      expect(user).not.toBeNull()
      expect(user?.name).toBe('Alice')
    })

    test('findFirst with where clause', async () => {
      const user = await prisma.user.findFirst({
        where: { age: { gt: 20 } },
      })

      expect(user).not.toBeNull()
      expect(user?.age).toBeGreaterThan(20)
    })

    test('findMany with include (relations)', async () => {
      const users = await prisma.user.findMany({
        where: { email: 'bob@surrealdb.com' },
        include: { posts: true },
      })

      expect(users).toHaveLength(1)
      expect(users[0].posts.length).toBeGreaterThanOrEqual(1)
    })

    test('findMany with select', async () => {
      const users = await prisma.user.findMany({
        select: { email: true, name: true },
        where: { email: 'alice@surrealdb.com' },
      })

      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('alice@surrealdb.com')
      expect(users[0].name).toBe('Alice')
      expect((users[0] as any).age).toBeUndefined()
    })

    // ============================================================
    // UPDATE
    // ============================================================

    test('update a single user', async () => {
      const updated = await prisma.user.update({
        where: { email: 'alice@surrealdb.com' },
        data: { name: 'Alice Updated', age: 31 },
      })

      expect(updated.name).toBe('Alice Updated')
      expect(updated.age).toBe(31)
    })

    test('updateMany', async () => {
      const result = await prisma.user.updateMany({
        where: { age: { gte: 30 } },
        data: { age: 99 },
      })

      expect(result.count).toBeGreaterThanOrEqual(1)
    })

    test('upsert - update existing', async () => {
      const user = await prisma.user.upsert({
        where: { email: 'alice@surrealdb.com' },
        update: { name: 'Alice Upserted' },
        create: { email: 'alice@surrealdb.com', name: 'Alice New' },
      })

      expect(user.name).toBe('Alice Upserted')
    })

    test('upsert - create new', async () => {
      const user = await prisma.user.upsert({
        where: { email: 'charlie@surrealdb.com' },
        update: { name: 'Charlie Updated' },
        create: { email: 'charlie@surrealdb.com', name: 'Charlie', age: 25 },
      })

      expect(user.email).toBe('charlie@surrealdb.com')
      expect(user.name).toBe('Charlie')
    })

    // ============================================================
    // DELETE
    // ============================================================

    test('delete a single user', async () => {
      const deleted = await prisma.user.delete({
        where: { email: 'charlie@surrealdb.com' },
      })

      expect(deleted.email).toBe('charlie@surrealdb.com')
    })

    test('deleteMany', async () => {
      // Create temp users to delete
      await prisma.user.create({
        data: { email: 'temp1@surrealdb.com', name: 'Temp1' },
      })
      await prisma.user.create({
        data: { email: 'temp2@surrealdb.com', name: 'Temp2' },
      })

      const result = await prisma.user.deleteMany({
        where: { email: { contains: 'temp' } },
      })

      expect(result.count).toBe(2)
    })

    // ============================================================
    // AGGREGATION
    // ============================================================

    test('count users', async () => {
      const count = await prisma.user.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('aggregate - avg, min, max', async () => {
      const result = await prisma.user.aggregate({
        _avg: { age: true },
        _min: { age: true },
        _max: { age: true },
      })

      expect(result._avg.age).not.toBeNull()
      expect(result._min.age).not.toBeNull()
      expect(result._max.age).not.toBeNull()
    })

    // ============================================================
    // TRANSACTIONS
    // ============================================================

    test('interactive transaction', async () => {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: 'tx-user@surrealdb.com', name: 'TX User' },
        })

        const fetched = await tx.user.findUnique({
          where: { id: user.id },
        })

        return fetched
      })

      expect(result?.name).toBe('TX User')

      // Clean up
      await prisma.user.delete({ where: { email: 'tx-user@surrealdb.com' } })
    })

    // ============================================================
    // FILTERING & ORDERING
    // ============================================================

    test('where - contains filter', async () => {
      const users = await prisma.user.findMany({
        where: { email: { contains: 'surrealdb.com' } },
      })

      expect(users.length).toBeGreaterThanOrEqual(1)
    })

    test('where - startsWith filter', async () => {
      const users = await prisma.user.findMany({
        where: { email: { startsWith: 'alice' } },
      })

      expect(users.length).toBeGreaterThanOrEqual(1)
    })

    test('where - in filter', async () => {
      const users = await prisma.user.findMany({
        where: { email: { in: ['alice@surrealdb.com', 'bob@surrealdb.com'] } },
      })

      expect(users.length).toBe(2)
    })

    test('where - NOT filter', async () => {
      const users = await prisma.user.findMany({
        where: { NOT: { email: 'alice@surrealdb.com' } },
      })

      expect(users.every((u) => u.email !== 'alice@surrealdb.com')).toBe(true)
    })

    test('orderBy ascending', async () => {
      const users = await prisma.user.findMany({
        orderBy: { email: 'asc' },
      })

      for (let i = 1; i < users.length; i++) {
        expect(users[i].email >= users[i - 1].email).toBe(true)
      }
    })

    test('orderBy descending', async () => {
      const users = await prisma.user.findMany({
        orderBy: { email: 'desc' },
      })

      for (let i = 1; i < users.length; i++) {
        expect(users[i].email <= users[i - 1].email).toBe(true)
      }
    })

    test('take and skip (pagination)', async () => {
      const page = await prisma.user.findMany({
        take: 1,
        skip: 1,
        orderBy: { email: 'asc' },
      })

      expect(page).toHaveLength(1)
    })

    // ============================================================
    // NULLABLE FIELDS
    // ============================================================

    test('create with null optional field', async () => {
      const user = await prisma.user.create({
        data: { email: 'nullable@surrealdb.com', name: null },
      })

      expect(user.name).toBeNull()

      // Clean up
      await prisma.user.delete({ where: { email: 'nullable@surrealdb.com' } })
    })

    test('filter by null', async () => {
      await prisma.user.create({
        data: { email: 'hasnull@surrealdb.com' },
      })

      const users = await prisma.user.findMany({
        where: { name: null },
      })

      expect(users.length).toBeGreaterThanOrEqual(1)

      // Clean up
      await prisma.user.delete({ where: { email: 'hasnull@surrealdb.com' } })
    })

    // ============================================================
    // CLEANUP
    // ============================================================

    afterAll(async () => {
      await prisma.post.deleteMany()
      await prisma.user.deleteMany()
    })
  },
  {
    optOut: {
      from: ['sqlite', 'postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'SurrealDB-only test suite',
    },
  },
)
