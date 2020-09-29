import { generateTestClient } from '../../../../utils/getTestClient'
import {
  SetupParams,
  setupMysql,
  tearDownMysql,
} from '../../../../utils/setupMysql'

describe('int-errors', () => {
  let prisma
  let SetupParams: SetupParams

  beforeAll(async () => {
    await generateTestClient()
    const { PrismaClient } = require('@prisma/client')
    let originalConnectionString =
      process.env.TEST_MYSQL_URI || 'mysql://prisma:prisma@localhost:3306/tests'

    originalConnectionString += '-signed-int'

    SetupParams = {
      connectionString: originalConnectionString,
      dirname: __dirname,
    }

    await setupMysql(SetupParams).catch((e) => console.error(e))

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: originalConnectionString,
        },
      },
      errorFormat: 'minimal',
    })
  })

  afterAll(async () => {
    prisma.$disconnect()

    await tearDownMysql(SetupParams).catch((e) => {
      console.log(e)
    })
  })

  test('char-int', async () => {
    try {
      await prisma.user.update({
        where: { id: '576eddf9-2434-421f-9a86-58bede16fd95' },
        data: {
          age: 'thisisastringwith30characters',
        },
      })
      expect(1).toEqual(0) //should never reach.
    } catch (e) {
      expect(e.clientVersion).toMatchInlineSnapshot(`local`)
      expect(e).toMatchInlineSnapshot(`
        Argument age: Got invalid value 'thisisastringwith30characters' on prisma.updateOneUser. Provided String, expected Int or NullableIntFieldUpdateOperationsInput or Null.

      `)
    }
  })

  test('overflow-int', async () => {
    try {
      await prisma.user.update({
        where: { id: '576eddf9-2434-421f-9a86-58bede16fd95' },
        data: {
          age: 999,
        },
      })
      expect(1).toEqual(0) //should never reach.
    } catch (e) {
      expect(e.clientVersion).toMatchInlineSnapshot(`local`)
      expect(e).toMatchInlineSnapshot(`
        error: Environment variable not found: TEST_MYSQL_URI.
          -->  schema.prisma:3
           | 
         2 |   provider = "mysql"
         3 |   url      = env("TEST_MYSQL_URI")
           | 

        Validation Error Count: 1
      `)
    }
  })

  test('signed-int', async () => {
    try {
      await prisma.user.update({
        where: { id: '576eddf9-2434-421f-9a86-58bede16fd95' },
        data: {
          age: -999,
        },
      })
      expect(1).toEqual(0) //should never reach.
    } catch (e) {
      expect(e.clientVersion).toMatchInlineSnapshot(`local`)
      expect(e).toMatchInlineSnapshot(`
        error: Environment variable not found: TEST_MYSQL_URI.
          -->  schema.prisma:3
           | 
         2 |   provider = "mysql"
         3 |   url      = env("TEST_MYSQL_URI")
           | 

        Validation Error Count: 1
      `)

      prisma.$disconnect()
    }
  })
})
