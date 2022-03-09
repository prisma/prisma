import type { PrismaClient } from '@prisma/client'

import { setup } from '../../_utils/setup'

setup<PrismaClient>((PrismaClient) => {
  test('simpleInput', async () => {
    const prisma = new (await PrismaClient)()

    // console.log(await prisma.user.findMany())
  })
})
