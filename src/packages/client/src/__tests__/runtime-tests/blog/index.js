const {
  PrismaClient,
  PrismaClientValidationError,
  PrismaClientKnownRequestError,
  prismaVersion,
  sql,
  raw,
  join,
  empty,
} = require('@prisma/client')
const assert = require('assert')

module.exports = async () => {
  const requests = []
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
    .findOne({
      where: {
        email: 'a@a.de',
      },
    })
    .posts()

  assert.equal(posts.length, 0)
  db.disconnect()
  assert.equal(requests.length, 2)

  await db.user.findMany()
  db.disconnect()
  assert.equal(requests.length, 3)

  const count = await db.user.count()
  assert(typeof count === 'number')

  const paramCount = await db.user.count({
    take: 10000,
  })

  assert(typeof paramCount === 'number')

  db.connect()
  await db.disconnect()

  await new Promise((r) => setTimeout(r, 200))
  db.connect()

  const userPromise = db.user.findMany()
  await userPromise
  // @ts-ignore

  await db.disconnect()

  await db.connect()

  /**
   * queryRaw
   */

  // Test queryRaw(string)
  const rawQuery = await db.queryRaw('SELECT 1')
  assert(
    rawQuery[0]['1'] === 1,
    "prisma.queryRaw('SELECT 1') result should be [ { '1': 1 } ]",
  )

  // Test queryRaw(string, values)
  const rawQueryWithValues = await db.queryRaw(
    'SELECT $1 AS name, $2 AS id',
    'Alice',
    42,
  )
  assert(
    rawQueryWithValues[0].name === 'Alice' && rawQueryWithValues[0].id === 42,
    "prisma.queryRaw('SELECT $1 AS name, $2 AS id', 'Alice', 42) result should be [ { name: 'Alice', id: 42 } ]",
  )

  // Test queryRaw``
  const rawQueryTemplate = await db.queryRaw`SELECT 1`
  assert(
    rawQueryTemplate[0]['1'] === 1,
    "prisma.queryRaw`SELECT 1` result should be [ { '1': 1 } ]",
  )

  // Test queryRaw`` with ${param}
  const rawQueryTemplateWithParams = await db.queryRaw`SELECT * FROM User WHERE name = ${'Alice'}`
  assert(
    rawQueryTemplateWithParams[0].name === 'Alice',
    "prisma.queryRaw`SELECT * FROM User WHERE name = ${'Alice'}` result should be [{ email: 'a@a.de', id: '576eddf9-2434-421f-9a86-58bede16fd95', name: 'Alice' }]",
  )

  // Test queryRaw`` with prisma.sql``
  const rawQueryTemplateFromSqlTemplate = await db.queryRaw(
    sql`
      SELECT ${join([raw('email'), raw('id'), raw('name')])}
      FROM ${raw('User')}
      ${sql`WHERE name = ${'Alice'}`}
      ${empty}
    `,
  )
  assert(
    rawQueryTemplateFromSqlTemplate[0].name === 'Alice',
    "prisma.queryRaw(prisma.sql`SELECT * FROM ${join([raw('email'),raw('id'),raw('name')])} ${sql`WHERE name = ${'Alice'}`} ${empty}` result should be [{ email: 'a@a.de', id: '576eddf9-2434-421f-9a86-58bede16fd95', name: 'Alice' }]",
  )

  /**
   * executeRaw
   */

  // Test executeRaw(string)
  const executeRaw = await db.executeRaw(
    'UPDATE User SET name = $1 WHERE id = $2',
    'name',
    'id',
  )
  assert(
    executeRaw === 0,
    "prisma.executeRaw('UPDATE User SET name = $1 WHERE id = $2') result should be 0",
  )

  // Test executeRaw(string, values)
  const executeRawWithValues = await db.executeRaw(
    'UPDATE User SET name = $1 WHERE id = $2',
    'Alice',
    'id',
  )
  assert(
    executeRawWithValues === 0,
    "prisma.executeRaw('UPDATE User SET name = $1 WHERE id = $2', 'Alice', 42) result should be 0",
  )

  // Test executeRaw``
  const executeRawTemplate = await db.executeRaw`UPDATE User SET name = ${'name'} WHERE id = ${'id'}`
  assert.equal(executeRawTemplate, 0)

  // Test validation errors
  let validationError
  try {
    await db.post.create({
      data: {},
    })
  } catch (e) {
    validationError = e
  } finally {
    if (
      !validationError ||
      !(validationError instanceof PrismaClientValidationError)
    ) {
      throw new Error(`Validation error is incorrect`)
    }
  }

  // Test known request error
  let knownRequestError
  try {
    const result = await db.user.create({
      data: {
        email: 'a@a.de',
        name: 'Alice',
      },
    })
  } catch (e) {
    knownRequestError = e
  } finally {
    if (
      !knownRequestError ||
      !(knownRequestError instanceof PrismaClientKnownRequestError)
    ) {
      throw new Error(`Known request error is incorrect`)
    } else {
      if (!knownRequestError.message.includes('.user.create()')) {
        throw new Error(`Invalid error: ${knownRequestError.message}`)
      }
    }
  }

  db.disconnect()
}

if (require.main === module) {
  module.exports()
}
