const {
  PrismaClient,
  PrismaClientValidationError,
  PrismaClientKnownRequestError,
  prismaVersion,
} = require('@prisma/client')

const { uriToCredentials, credentialsToUri } = require('@prisma/sdk')
const tcpProxy = require('node-tcp-proxy')
const getPort = require('get-port')

const assert = require('assert')
const { Client } = require('pg')

module.exports = async () => {
  const originalConnectionString =
    process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev'

  const credentials = uriToCredentials(originalConnectionString)
  const sourcePort = credentials.port || 5432
  const newPort = await getPort({
    port: getPort.makeRange(3100, 3200),
  })
  let proxy = tcpProxy.createProxy(newPort, credentials.host, sourcePort)

  const connectionString = credentialsToUri({
    ...credentials,
    host: 'localhost',
    port: newPort,
  })

  const db = new Client({
    connectionString: originalConnectionString,
  })
  await db.connect()
  await db.query(`
    DROP TYPE IF EXISTS "Role";
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

    DROP TABLE IF EXISTS "public"."Post" CASCADE;
    CREATE TABLE "public"."Post" (
        "id" text NOT NULL,
        "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamp(3) NOT NULL DEFAULT '1970-01-01 00:00:00'::timestamp without time zone,
        "published" boolean NOT NULL DEFAULT false,
        "title" text NOT NULL,
        "content" text,
        "authorId" text,
        "jsonData" jsonb,
        PRIMARY KEY ("id")
    );

    DROP TABLE IF EXISTS "public"."User" CASCADE;
    CREATE TABLE "public"."User" (
        "id" text,
        "email" text NOT NULL,
        "name" text,
        PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "User.email" ON "public"."User"("email");

    ALTER TABLE "public"."Post" ADD FOREIGN KEY ("authorId") REFERENCES "public"."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

    INSERT INTO "public"."User" (email, id, name) VALUES ('a@a.de',	'576eddf9-2434-421f-9a86-58bede16fd95',	'Alice');
  `)

  const requests = []
  const errorLogs = []
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
    __internal: {
      measurePerformance: true,
      hooks: {
        beforeRequest: (request) => requests.push(request),
      },
    },
    datasources: {
      db: {
        url: connectionString,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'error',
      },
    ],
  })

  // Make sure we're not leaking connection strings in node_modules

  assert.equal(prisma.internalDatasources, undefined)

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  // Test connecting and disconnecting all the time
  await prisma.user.findMany()
  prisma.disconnect()
  assert(requests.length === 1)

  await prisma.user.findMany()
  prisma.disconnect()

  // flakyness :shrug:
  await new Promise((r) => setTimeout(r, 200))
  assert(requests.length === 2)

  const count = await prisma.user.count()
  assert(typeof count === 'number')

  prisma.connect()
  await prisma.disconnect()

  await new Promise((r) => setTimeout(r, 200))
  prisma.connect()

  const userPromise = prisma.user.findMany()
  await userPromise
  // @ts-ignore

  await prisma.disconnect()

  await prisma.connect()

  // Test queryRaw(string)
  const rawQuery = await prisma.queryRaw('SELECT 1')
  assert.equal(
    rawQuery[0]['?column?'],
    1,
    "prisma.queryRaw('SELECT 1') result should be [ { '?column?': 1 } ]",
  )

  // Test queryRaw``
  const rawQueryTemplate = await prisma.queryRaw`SELECT 1`
  assert.equal(
    rawQueryTemplate[0]['?column?'],
    1,
    "prisma.queryRaw`SELECT 1` result should be [ { '?column?': 1 } ]",
  )

  // Test queryRaw`` with ${param}
  const rawQueryTemplateWithParams = await prisma.queryRaw`SELECT * FROM "public"."User" WHERE name = ${'Alice'}`
  assert.equal(
    rawQueryTemplateWithParams[0].name,
    'Alice',
    "prisma.queryRaw`SELECT * FROM User WHERE name = ${'Alice'}` result should be [{ email: 'a@a.de', id: 11233, name: 'Alice' }]",
  )

  // Test executeRaw(string)
  const rawexecute = await prisma.executeRaw('SELECT 1')
  assert.equal(rawexecute, 1, 'executeRaw SELECT 1 must return 0')

  // Test executeRaw``
  const rawexecuteTemplate = await prisma.executeRaw`SELECT 1`
  assert.equal(rawexecuteTemplate, 1, 'executeRaw SELECT 1 must return 0')

  // Test executeRaw`` with ${param}
  const rawexecuteTemplateWithParams = await prisma.executeRaw`SELECT * FROM "public"."User" WHERE name = ${'Alice'}`
  assert.equal(
    rawexecuteTemplateWithParams,
    1,
    'SELECT * FROM "public"."User" WHERE name = ',
  )

  // Test validation errors
  let validationError
  try {
    await prisma.post.create({
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

  prisma.on('error', (e) => {
    errorLogs.push(e)
  })

  proxy.end()
  try {
    const users = await prisma.user.findMany()
  } catch (e) {}
  proxy = tcpProxy.createProxy(newPort, credentials.host, sourcePort)
  await new Promise((r) => setTimeout(r, 16000))
  assert.equal(errorLogs.length, 1)
  try {
    const users = await prisma.user.findMany()
  } catch (e) {}
  const users = await prisma.user.findMany()
  assert.equal(users.length, 1)
  const resultEmptyJson = await prisma.post.create({
    data: {
      published: false,
      title: 'empty json',
      jsonData: [],
    },
  })

  await prisma.post.delete({
    where: { id: resultEmptyJson.id },
  })

  const resultJsonArray = await prisma.post.create({
    data: {
      published: false,
      title: 'json array',
      jsonData: [
        {
          array1key: 'array1value',
        },
      ],
    },
  })

  const result = await prisma.post.findMany({
    where: {
      jsonData: [
        {
          array1key: 'array1value',
        },
      ],
    },
  })

  assert.equal(result.length, 1, 'We should be able to query by json data')

  await prisma.post.delete({
    where: { id: resultJsonArray.id },
  })

  prisma.disconnect()
  await db.query(`
    DROP TABLE IF EXISTS "public"."Post" CASCADE;
    DROP TABLE IF EXISTS "public"."User" CASCADE;
  `)
  await db.end()
  proxy.end()
}

if (require.main === module) {
  module.exports()
}
