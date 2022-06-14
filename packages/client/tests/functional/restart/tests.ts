import { faker } from '@faker-js/faker'
import { ClientEngineType, getClientEngineType } from '@prisma/sdk'
import * as util from 'util'

import testMatrix from './_matrix'

const sleep = util.promisify(setTimeout)

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let PrismaClient: typeof import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  test('should assert that PrismaClient is restarted when it goes down', async () => {
    // No child process for Node-API, so nothing that can be killed or tested
    if (getClientEngineType() === ClientEngineType.Library) {
      return
    }

    // Disconnect from the injected client - we only use this to apply migrations.
    await prisma.$disconnect()

    const client = new PrismaClient()
    await client.$connect()

    const username = faker.internet.userName()

    await client.user.create({ data: { username } })

    // @ts-ignore kill the binary child process
    client._engine.child.kill()
    await sleep(1000)

    const [found1] = await client.user.findMany({ where: { username } })
    expect(found1).toBeTruthy()

    // kill the binary child process again and again, to make sure it also comes back
    for (let i = 0; i < 7; i++) {
      // @ts-ignore private member
      client._engine.child.kill()
      await sleep(200)
    }

    const [found2] = await client.user.findMany({ where: { username } })
    expect(found2).toBeTruthy()

    client.$disconnect().catch(() => undefined)
  })
})
