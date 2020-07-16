import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
})

async function main() {
  const res = await prisma.user
    .findOne({
      where: {
        email: 'a0@asd.de',
      },
    })
    .posts()
  console.log(res)
  prisma.disconnect()
}

async function seed() {
  for (let i = 0; i < 10; i++) {
    await prisma.user.create({
      data: {
        email: `a${i}@asd.de`,
        age: 29,
        name: 'Bob',
      },
    })
  }
}

main().catch((e) => {
  console.error(e)
})
