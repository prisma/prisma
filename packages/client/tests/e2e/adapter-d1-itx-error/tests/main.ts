import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/driver-d1'

const prisma = new PrismaClient({
  errorFormat: 'minimal',
  // There is need to pass the adapter here for this test
  // @ts-ignore
  driver: new PrismaD1('something'),
})

test('errors when iTx is used', async () => {
  try {
    await prisma.$transaction(async (prisma) => {
      console.debug('iTx ...')
      await prisma.user.create({
        data: {
          id: 1,
        },
      })
    })
  } catch (e: any) {
    // Message from client/src/runtime/getPrismaClient.ts
    expect(e.message).toMatch(`Cloudflare D1 does not support interactive transactions.`)
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})
