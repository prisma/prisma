import { PrismaClient } from '.prisma/client'
import { Client } from '@planetscale/database'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'

const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL}`

async function main() {
  const client = new Client({ url: connectionString })
  const adapter = new PrismaPlanetScale(client)
  const prisma = new PrismaClient({ adapter })

  await prisma.binary.deleteMany()

  await prisma.binary.create({
    data: {
      id: '1',
      bytes: Buffer.from('AQID'),
    },
  })

  await prisma.binary.create({
    data: {
      id: '2',
      bytes: Buffer.from('FSDF'),
    },
  })

  await prisma.binary.create({
    data: {
      id: '3',
      bytes: Buffer.from('AA'),
    },
  })

  const result = await prisma.binary.findMany()
  console.log('result')
  console.dir(result, { depth: null })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
