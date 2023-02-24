import { getQueryEngineProtocol } from '@prisma/internals'

import { generateTestClient } from '../../../../utils/getTestClient'
import type { SetupParams } from '../../../../utils/setupMysql'
import { setupMysql, tearDownMysql } from '../../../../utils/setupMysql'

const testIf = (condition: boolean) => (condition ? test : test.skip)
describe('int-errors', () => {
  let prisma
  let SetupParams: SetupParams

  beforeAll(async () => {
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    let originalConnectionString = process.env.TEST_MYSQL_URI

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
    await prisma.$disconnect()

    await tearDownMysql(SetupParams.connectionString).catch((e) => {
      console.log(e)
    })
  })

  testIf(getQueryEngineProtocol() !== 'json')('char-int', async () => {
    try {
      await prisma.user.update({
        where: { id: '576eddf9-2434-421f-9a86-58bede16fd95' },
        data: {
          age: 'thisisastringwith30characters',
        },
      })
      expect(1).toEqual(0) //should never reach.
    } catch (e) {
      expect(e).toMatchSnapshot()
    }
  })

  testIf(getQueryEngineProtocol() !== 'json')('overflow-int', async () => {
    try {
      await prisma.user.update({
        where: { id: '576eddf9-2434-421f-9a86-58bede16fd95' },
        data: {
          age: 999,
        },
      })
      expect(1).toEqual(0) //should never reach.
    } catch (e) {
      expect(e).toMatchSnapshot()
    }
  })

  testIf(getQueryEngineProtocol() !== 'json')('signed-int', async () => {
    try {
      await prisma.user.update({
        where: { id: '576eddf9-2434-421f-9a86-58bede16fd95' },
        data: {
          age: -999,
        },
      })
      expect(1).toEqual(0) //should never reach.
    } catch (e) {
      expect(e).toMatchSnapshot()
    }
  })
})
