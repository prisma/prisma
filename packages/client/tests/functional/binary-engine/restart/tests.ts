import { faker } from '@faker-js/faker'
import { ClientEngineType } from '@prisma/internals'
import type { ChildProcess } from 'node:child_process'

import type { NewPrismaClient } from '../../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

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

testMatrix.setupTestSuite(({ engineType }) => {
  let client: PrismaClient

  afterEach(() => {
    if (client) {
      client.$disconnect().catch(() => undefined)
    }
  })

  test('should assert that PrismaClient is restarted when it goes down', async () => {
    // Only child process for Binary, so nothing that can be killed or tested with other engines
    if (engineType !== ClientEngineType.Binary) {
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
