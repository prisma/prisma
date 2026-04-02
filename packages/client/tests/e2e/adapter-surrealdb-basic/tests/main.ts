import { PrismaSurrealDb } from '@prisma/adapter-surrealdb'
import { PrismaClient } from '@prisma/client'

const url = process.env.SURREALDB_URL ?? 'surrealdb://root:root@localhost:8000/test/e2e'

const prisma = new PrismaClient({
  adapter: new PrismaSurrealDb(url, {
    namespace: 'test',
    database: 'e2e',
  }),
})

describe('SurrealDB adapter e2e', () => {
  beforeAll(async () => {
    // Clean up from previous runs
    await prisma.post.deleteMany().catch(() => {})
    await prisma.user.deleteMany().catch(() => {})
  })

  // ==================== CREATE ====================

  test('create a user', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'alice@e2e.test',
        name: 'Alice',
      },
    })

    expect(user.id).toBeTruthy()
    expect(user.email).toBe('alice@e2e.test')
    expect(user.name).toBe('Alice')
  })

  test('create a user with nested post', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'bob@e2e.test',
        name: 'Bob',
        posts: {
          create: {
            title: 'First Post',
            content: 'Hello from SurrealDB!',
            published: true,
          },
        },
      },
      include: { posts: true },
    })

    expect(user.posts).toHaveLength(1)
    expect(user.posts[0].title).toBe('First Post')
  })

  // ==================== READ ====================

  test('findMany', async () => {
    const users = await prisma.user.findMany()
    expect(users.length).toBeGreaterThanOrEqual(2)
  })

  test('findUnique', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'alice@e2e.test' },
    })
    expect(user).not.toBeNull()
    expect(user!.name).toBe('Alice')
  })

  test('findFirst with filter', async () => {
    const user = await prisma.user.findFirst({
      where: { name: { contains: 'Ali' } },
    })
    expect(user).not.toBeNull()
  })

  test('findMany with include', async () => {
    const users = await prisma.user.findMany({
      where: { email: 'bob@e2e.test' },
      include: { posts: true },
    })
    expect(users[0].posts.length).toBeGreaterThanOrEqual(1)
  })

  test('findMany with select', async () => {
    const users = await prisma.user.findMany({
      select: { email: true },
    })
    expect(users.length).toBeGreaterThanOrEqual(1)
    expect((users[0] as any).name).toBeUndefined()
  })

  test('findMany with ordering', async () => {
    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
    })
    for (let i = 1; i < users.length; i++) {
      expect(users[i].email >= users[i - 1].email).toBe(true)
    }
  })

  test('findMany with pagination', async () => {
    const page = await prisma.user.findMany({
      take: 1,
      skip: 1,
      orderBy: { email: 'asc' },
    })
    expect(page).toHaveLength(1)
  })

  // ==================== UPDATE ====================

  test('update', async () => {
    const updated = await prisma.user.update({
      where: { email: 'alice@e2e.test' },
      data: { name: 'Alice Updated' },
    })
    expect(updated.name).toBe('Alice Updated')
  })

  test('upsert existing', async () => {
    const user = await prisma.user.upsert({
      where: { email: 'alice@e2e.test' },
      update: { name: 'Alice Upserted' },
      create: { email: 'alice@e2e.test', name: 'Should Not Create' },
    })
    expect(user.name).toBe('Alice Upserted')
  })

  test('upsert new', async () => {
    const user = await prisma.user.upsert({
      where: { email: 'charlie@e2e.test' },
      update: { name: 'Charlie Updated' },
      create: { email: 'charlie@e2e.test', name: 'Charlie' },
    })
    expect(user.email).toBe('charlie@e2e.test')
    expect(user.name).toBe('Charlie')
  })

  // ==================== AGGREGATE ====================

  test('count', async () => {
    const count = await prisma.user.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  // ==================== TRANSACTIONS ====================

  test('interactive transaction', async () => {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: 'tx@e2e.test', name: 'TX' },
      })
      return tx.user.findUnique({ where: { id: user.id } })
    })
    expect(result!.name).toBe('TX')
  })

  // ==================== DELETE ====================

  test('delete', async () => {
    const deleted = await prisma.user.delete({
      where: { email: 'charlie@e2e.test' },
    })
    expect(deleted.email).toBe('charlie@e2e.test')
  })

  test('deleteMany', async () => {
    await prisma.user.create({ data: { email: 'temp1@e2e.test' } })
    await prisma.user.create({ data: { email: 'temp2@e2e.test' } })

    const result = await prisma.user.deleteMany({
      where: { email: { contains: 'temp' } },
    })
    expect(result.count).toBe(2)
  })

  // ==================== CLEANUP ====================

  afterAll(async () => {
    await prisma.post.deleteMany().catch(() => {})
    await prisma.user.deleteMany().catch(() => {})
    await prisma.$disconnect()
  })
})
