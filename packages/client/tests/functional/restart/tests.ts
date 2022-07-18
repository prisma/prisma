import { faker } from '@faker-js/faker'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import { ChildProcess } from 'child_process'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
type PrismaClient = import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let newPrismaClient: NewPrismaClient<typeof PrismaClient>

function waitForChildExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    function listener() {
      resolve()
      child.removeListener('exit', listener)
    }

    child.on('exit', listener)
  })
}

testMatrix.setupTestSuite(() => {
  // @ts-ignore internal
  let client: PrismaClient

  afterEach(() => {
    if (client) {
      client.$disconnect().catch(() => undefined)
    }
  })

  test('should assert that PrismaClient is restarted when it goes down', async () => {
    // No child process for Node-API, so nothing that can be killed or tested
    if (getClientEngineType() === ClientEngineType.Library) {
      return
    }

    client = newPrismaClient()
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
  })
})
