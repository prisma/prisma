// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import { setupClientTest } from '../../_utils/setupClientTest'

setupClientTest<typeof PrismaClient>((prisma, getClient) => {
  beforeAll(async () => (prisma = await getClient({})))

  test('simpleInput1', async () => {
    await prisma.user.findMany()
  })
})
