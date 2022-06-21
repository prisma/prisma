import { faker } from '@faker-js/faker'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import { ChildProcess } from 'child_process'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let PrismaClient: typeof import('@prisma/client').PrismaClient

function waitForChildExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.on('exit', () => {
      resolve()
    })
  })
}

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

    // @ts-ignore internal
    const waiter1 = waitForChildExit(client._engine.child)
    // @ts-ignore internal
    client._engine.child.kill()
    await waiter1

    const [found1] = await client.user.findMany({ where: { username } })
    expect(found1).toBeTruthy()

    // @ts-ignore internal
    const waiter2 = waitForChildExit(client._engine.child as ChildProcess)
    // @ts-ignore internal
    client._engine.child.kill()
    await waiter2

    const [found2] = await client.user.findMany({ where: { username } })
    expect(found2).toBeTruthy()

    client.$disconnect().catch(() => undefined)
  })
})
