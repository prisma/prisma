import 'source-map-support/register'
import { getTestClient } from '../../../../utils/getTestClient'

// X is here to have a different line count in the transpiled js and ts
type X = {}

test('source-map-support', async () => {
  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await expect(prisma.$connect().catch((err) => {
    console.log(err)
  }).then(() => {
    return prisma.user.findOne({ where: { id: null as any } })
  })).rejects.toMatchSnapshot()

  prisma.$disconnect()
})
