import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
  __internal: {
    useUds: true,
  },
} as any)

async function main() {
  const x = await prisma.user.findOne({
    where: {
      email: 'a@a.de'
    }
  })
    .property()
    .house()
    .like()
    .post()
    .author()
  console.log(x)
  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
