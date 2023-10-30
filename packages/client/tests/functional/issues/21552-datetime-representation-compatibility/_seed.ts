import { PrismaClient } from './node_modules/@prisma/client'

async function main() {
  const prisma = new PrismaClient()

  const record = await prisma.test.create({
    data: {
      dt: new Date(),
    },
  })

  console.log(JSON.stringify(record))
}

void main()
