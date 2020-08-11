import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
  __internal: {
    useUds: true,
  },
} as any)

async function main() {
  const x = await prisma.user.findMany()
  console.log(x)
  prisma.disconnect()
}

main().catch((e) => {
  console.error(e)
})
