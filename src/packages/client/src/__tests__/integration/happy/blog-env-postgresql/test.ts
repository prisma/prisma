import { uriToCredentials, credentialsToUri, createDatabase } from '@prisma/sdk'
import { Client } from 'pg'
import { generateTestClient } from '../../../../utils/getTestClient'

test('blog-env-postgresql', async () => {
  await generateTestClient()

  const {
    PrismaClient,
    PrismaClientValidationError,
    prismaVersion,
  } = require('@prisma/client')

  let originalConnectionString =
    (process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev')

  originalConnectionString += '-blog-env-postgresql'
  await createDatabase(originalConnectionString).catch(e => console.error(e))

  const credentials = uriToCredentials(originalConnectionString)
  const sourcePort = credentials.port || 5432

  const connectionString = credentialsToUri({
    ...credentials,
    host: 'localhost',
    port: sourcePort,
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
        "coinflips" _bool,
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

  const requests: any[] = []
  const errorLogs: any[] = []
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

  expect(prisma.internalDatasources).toBe(undefined)

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  // Test queryRaw(string)
  const rawQuery = await prisma.$queryRaw('SELECT 1')
  expect(rawQuery[0]['?column?']).toBe(1)

  // Test queryRaw``
  const rawQueryTemplate = await prisma.$queryRaw`SELECT 1`
  expect(rawQueryTemplate[0]['?column?']).toBe(1)

  // Test queryRaw`` with ${param}
  const rawQueryTemplateWithParams = await prisma.$queryRaw`SELECT * FROM "public"."User" WHERE name = ${'Alice'}`
  expect(rawQueryTemplateWithParams[0].name).toBe('Alice')

  // Test executeRaw(string)
  const rawexecute = await prisma.$executeRaw('SELECT 1')
  expect(rawexecute).toBe(1)

  // Test executeRaw``
  const rawexecuteTemplate = await prisma.$executeRaw`SELECT 1`
  expect(rawexecuteTemplate).toBe(1)

  // Test executeRaw`` with ${param}
  const rawexecuteTemplateWithParams = await prisma.$executeRaw`SELECT * FROM "public"."User" WHERE name = ${'Alice'}`
  expect(rawexecuteTemplateWithParams).toBe(1)

  // Test validation errors
  let validationError
  try {
    await prisma.post.create({
      data: {},
    })
  } catch (e) {
    validationError = e
    errorLogs.push(validationError)
  } finally {
    if (
      !validationError ||
      !(validationError instanceof PrismaClientValidationError)
    ) {
      throw new Error(`Validation error is incorrect`)
    }
  }

  expect(errorLogs.length).toBe(1)
  try {
    const users = await prisma.user.findMany()
  } catch (e) { }
  const users = await prisma.user.findMany()
  expect(users.length).toBe(1)
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
      jsonData: {
        equals: [
          {
            array1key: 'array1value',
          },
        ],
      },
    },
  })

  expect(result.length).toBe(1)

  const resultWhereNull = await prisma.post.findMany({
    where: {
      content: null,
    },
  })

  const result2 = await prisma.post.findMany({
    where: {
      jsonData: {
        not: [
          {
            array1key: 'array1value',
          },
        ],
      },
    },
  })

  expect(result2).toEqual([])

  expect(resultWhereNull.length).toBe(1)

  const resultJsonUpdateWithSet = await prisma.post.update({
    where: {
      id: resultJsonArray.id,
    },
    data: {
      title: 'json array updated 2',
      jsonData: {
        set: [
          {
            array1key: 'array1valueupdated',
          },
        ],
      },
      coinflips: {
        set: [true, true, true, false, true],
      },
    },
    select: {
      authorId: true,
      coinflips: true,
      content: true,
      jsonData: true,
      published: true,
      title: true,
    },
  })

  expect(resultJsonUpdateWithSet).toMatchInlineSnapshot(`
    Object {
      authorId: null,
      coinflips: Array [
        true,
        true,
        true,
        false,
        true,
      ],
      content: null,
      jsonData: Object {
        set: Array [
          Object {
            array1key: array1valueupdated,
          },
        ],
      },
      published: false,
      title: json array updated 2,
    }
  `)

  const resultJsonUpdateWithoutSet = await prisma.post.update({
    where: {
      id: resultJsonArray.id,
    },
    data: {
      title: 'json array updated',
      jsonData: [
        {
          array1key: 'array1valueupdated',
        },
      ],
      // // TODO broken, needs to be fixed
      // coinflips: [true, true, true, false, true]
    },
  })

  expect(resultJsonUpdateWithoutSet.title).toBe('json array updated')

  const resultJsonUpdateWithoutSetDatetime = await prisma.post.update({
    where: {
      id: resultJsonArray.id,
    },
    data: {
      title: 'json array updated date',
      jsonData: new Date(),
    },
  })
  expect(resultJsonUpdateWithoutSetDatetime.title).toBe(
    'json array updated date',
  )

  await prisma.post.delete({
    where: { id: resultJsonArray.id },
  })

  prisma.$disconnect()
  await db.query(`
    DROP TABLE IF EXISTS "public"."Post" CASCADE;
    DROP TABLE IF EXISTS "public"."User" CASCADE;
  `)
  await db.end()
})
