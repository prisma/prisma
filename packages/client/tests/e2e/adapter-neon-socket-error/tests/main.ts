import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'

const adapter = new PrismaNeon({ connectionString: 'postgresql://user:pass@localhost:1/nonexistent' })
const prisma = new PrismaClient({ adapter, errorFormat: 'minimal' })

test('maps ECONNREFUSED to P1001 DatabaseNotReachable', async () => {
  await expect(prisma.user.findMany()).rejects.toMatchObject({
    name: 'PrismaClientKnownRequestError',
    code: 'P1001',
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})
