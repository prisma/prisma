import { generateTestClient } from '../../../../utils/getTestClient'

test('blog', async () => {
  await generateTestClient()

  const { PrismaClient, Prisma } = require('./node_modules/@prisma/client')

  const { prismaVersion, sql, raw, join, empty, PrismaClientValidationError, PrismaClientKnownRequestError } = Prisma

  const requests: any[] = []
  const db = new PrismaClient({
    errorFormat: 'colorless',
    __internal: {
      hooks: {
        beforeRequest: (request) => requests.push(request),
      },
    },
  })

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  // Test connecting and disconnecting all the time
  await db.user.findMany()
  const posts = await db.user
    .findUnique({
      where: {
        email: 'a@a.de',
      },
    })
    .posts()

  expect(posts.length).toBe(0)
  db.$disconnect()
  expect(requests.length).toBe(2)

  await db.user.findMany()
  db.$disconnect()
  expect(requests.length).toBe(3)

  const count = await db.user.count()
  expect(typeof count === 'number').toBe(true)

  const paramCount = await db.user.count({
    take: 10000,
  })

  expect(typeof paramCount === 'number').toBe(true)

  db.$connect()
  await db.$disconnect()

  await new Promise((r) => setTimeout(r, 200))
  db.$connect()

  const userPromise = db.user.findMany()
  await userPromise
  // @ts-ignore

  await db.$disconnect()

  await db.$connect()

  /**
   * queryRaw
   */

  // Test queryRaw(string)
  const rawQuery = await db.$queryRawUnsafe('SELECT 1')
  expect(rawQuery[0]['1']).toBe(BigInt('1'))

  // Test queryRaw(string, values)
  const rawQueryWithValues = await db.$queryRawUnsafe('SELECT $1 AS name, $2 AS id', 'Alice', 42)

  expect(rawQueryWithValues[0]).toEqual({
    name: 'Alice',
    id: BigInt('42'),
  })

  // Test queryRaw``
  const rawQueryTemplate = await db.$queryRaw`SELECT 1`
  expect(rawQueryTemplate[0]['1']).toBe(BigInt('1'))

  // Test queryRaw`` with ${param}
  const rawQueryTemplateWithParams = await db.$queryRaw`SELECT * FROM User WHERE name = ${'Alice'}`
  expect(rawQueryTemplateWithParams[0].name).toBe('Alice')

  // Test queryRaw`` with prisma.sql``
  const rawQueryTemplateFromSqlTemplate = await db.$queryRaw(
    sql`
      SELECT ${join([raw('email'), raw('id'), raw('name')])}
      FROM ${raw('User')}
      ${sql`WHERE name = ${'Alice'}`}
      ${empty}
    `,
  )
  expect(rawQueryTemplateFromSqlTemplate[0].name).toBe('Alice')

  /**
   * .$executeRaw(
   */

  // Test .$executeRaw((string)
  const executeRaw = await db.$executeRawUnsafe('UPDATE User SET name = $1 WHERE id = $2', 'name', 'id')
  expect(executeRaw).toBe(0)

  // Test .$executeRaw((string, values)
  const executeRawWithValues = await db.$executeRawUnsafe('UPDATE User SET name = $1 WHERE id = $2', 'Alice', 'id')
  expect(executeRawWithValues).toBe(0)

  // Test $executeRaw
  const $executeRawTemplate = await db.$executeRaw`UPDATE User SET name = ${'name'} WHERE id = ${'id'}`
  expect($executeRawTemplate).toBe(0)

  // Test validation errors
  let validationError
  try {
    await db.post.create({
      data: {},
    })
  } catch (e) {
    validationError = e
  }
  if (!validationError || !(validationError instanceof PrismaClientValidationError)) {
    throw new Error(`Validation error is incorrect`)
  }

  // Test known request error
  let knownRequestError
  try {
    await db.user.create({
      data: {
        email: 'a@a.de',
        name: 'Alice',
      },
    })
  } catch (e) {
    knownRequestError = e
  }
  if (!knownRequestError || !(knownRequestError instanceof PrismaClientKnownRequestError)) {
    throw new Error(`Known request error is incorrect`)
  } else {
    if (!knownRequestError.message.includes('.user.create()')) {
      throw new Error(`Invalid error: ${knownRequestError.message}`)
    }
  }

  // relation query where not null
  const relationWhereNotNull = await db.user.findMany({
    where: {
      profile: {
        bio: { not: null },
      },
    },
  })
  expect(relationWhereNotNull).toEqual([])

  db.$disconnect()
})
