import { faker } from '@faker-js/faker'
// @ts-ignore this is just for typechecks
import type { PrismaClient } from '@prisma/client'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import { ChildProcess } from 'child_process'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

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

    let child = (client as any)._engine.child as ChildProcess
    const waiter1 = waitForChildExit(child)
    child.kill()
    await waiter1

    const [found1] = await client.user.findMany({ where: { username } })
    expect(found1).toBeTruthy()

    child = (client as any)._engine.child as ChildProcess
    const waiter2 = waitForChildExit(child)
    child.kill()
    await waiter2

    const [found2] = await client.user.findMany({ where: { username } })
    expect(found2).toBeTruthy()
  })
})
