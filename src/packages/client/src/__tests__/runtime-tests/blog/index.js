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
      measurePerformance: true,
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
  db.disconnect()
  assert(requests.length === 1)

  await db.user.findMany()
  db.disconnect()
  assert(requests.length === 2)

  const count = await db.user.count()
  assert(typeof count === 'number')

  const paramCount = await db.user.count({
    first: 10000,
  })

  assert(typeof paramCount === 'number')

  db.connect()
  await db.disconnect()

  await new Promise((r) => setTimeout(r, 200))
  db.connect()

  const userPromise = db.user.findMany()
  await userPromise
  // @ts-ignore
  const perfResults = userPromise._collectTimestamps.getResults()
  if (Object.keys(perfResults).length === 0) {
    throw Error('measurePerformance is enabled but results object is empty')
  }

  await db.disconnect()

  await db.connect()

  // Test raw(string)
  const rawQuery = await db.raw('SELECT 1')
  if (rawQuery[0]['1'] !== 1) {
    throw Error("prisma.raw('SELECT 1') result should be [ { '1': 1 } ]")
  }

  // Test raw(string, values)
  const rawQueryWithValues = await db.raw(
    'SELECT $1 AS name, $2 AS id',
    'Alice',
    42,
  )
  if (
    rawQueryWithValues[0].name !== 'Alice' ||
    rawQueryWithValues[0].id !== 42
  ) {
    throw Error(
      "prisma.raw('SELECT $1 AS name, $2 AS id', 'Alice', 42) result should be [ { name: 'Alice', id: 42 } ]",
    )
  }

  // Test raw``
  const rawQueryTemplate = await db.raw`SELECT 1`
  if (rawQueryTemplate[0]['1'] !== 1) {
    throw Error("prisma.raw`SELECT 1` result should be [ { '1': 1 } ]")
  }

  // Test raw`` with ${param}
  const rawQueryTemplateWithParams = await db.raw`SELECT * FROM User WHERE name = ${'Alice'}`
  if (rawQueryTemplateWithParams[0].name !== 'Alice') {
    throw Error(
      "prisma.raw`SELECT * FROM User WHERE name = ${'Alice'}` result should be [{ email: 'a@a.de', id: '576eddf9-2434-421f-9a86-58bede16fd95', name: 'Alice' }]",
    )
  }

  // Test raw`` with prisma.sql``
  const rawQueryTemplateFromSqlTemplate = await db.raw(
    sql`
      SELECT ${join([raw('email'), raw('id'), raw('name')])}
      FROM ${raw('User')}
      ${sql`WHERE name = ${'Alice'}`}
      ${empty}
    `,
  )
  if (rawQueryTemplateFromSqlTemplate[0].name !== 'Alice') {
    throw Error(
      "prisma.raw(prisma.sql`SELECT * FROM ${join([raw('email'),raw('id'),raw('name')])} ${sql`WHERE name = ${'Alice'}`} ${empty}` result should be [{ email: 'a@a.de', id: '576eddf9-2434-421f-9a86-58bede16fd95', name: 'Alice' }]",
    )
  }

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
