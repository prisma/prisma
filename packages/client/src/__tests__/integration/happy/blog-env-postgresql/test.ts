import { generateTestClient } from '../../../../utils/getTestClient'
import type { SetupParams } from '../../../../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../../../../utils/setupPostgres'

test('Blog fixture: Postgres', async () => {
  await generateTestClient()

  const { PrismaClient, Prisma } = require('./node_modules/@prisma/client')

  const { PrismaClientValidationError, prismaVersion } = Prisma

  let originalConnectionString = process.env.TEST_POSTGRES_URI!
  originalConnectionString += '-blog-env-postgresql'

  const SetupParams: SetupParams = {
    connectionString: originalConnectionString,
    dirname: __dirname,
  }

  await setupPostgres(SetupParams).catch((e) => console.error(e))

  const errorLogs: any[] = []
  const prisma = new PrismaClient({
    errorFormat: 'colorless',
    __internal: {
      measurePerformance: true,
    },
    datasources: {
      db: {
        url: originalConnectionString,
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
  const rawQuery = await prisma.$queryRawUnsafe('SELECT 1')
  expect(rawQuery[0]['?column?']).toBe(1)

  // Test queryRaw``
  const rawQueryTemplate = await prisma.$queryRaw`SELECT 1`
  expect(rawQueryTemplate[0]['?column?']).toBe(1)

  // Test queryRaw`` with ${param}
  const rawQueryTemplateWithParams = await prisma.$queryRaw`SELECT * FROM "public"."User" WHERE name = ${'Alice'}`
  expect(rawQueryTemplateWithParams[0].name).toBe('Alice')

  // Test executeRaw(string)
  const rawexecute = await prisma.$executeRawUnsafe('SELECT 1')
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
  }

  if (!validationError || !(validationError instanceof PrismaClientValidationError)) {
    throw new Error(`Validation error is incorrect`)
  }

  expect(errorLogs.length).toBe(1)
  try {
    await prisma.user.findMany()
  } catch (e) {}
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
    {
      authorId: null,
      coinflips: [
        true,
        true,
        true,
        false,
        true,
      ],
      content: null,
      jsonData: {
        set: [
          {
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

  const resultJsonUpdateWithoutSetDateTime = await prisma.post.update({
    where: {
      id: resultJsonArray.id,
    },
    data: {
      title: 'json array updated date',
      jsonData: new Date(),
    },
  })
  expect(resultJsonUpdateWithoutSetDateTime.title).toBe('json array updated date')

  await prisma.post.delete({
    where: { id: resultJsonArray.id },
  })

  await prisma.$disconnect()
  await tearDownPostgres(SetupParams.connectionString).catch((e) => {
    console.log(e)
  })
})
