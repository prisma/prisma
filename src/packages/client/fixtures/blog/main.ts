import { PrismaClient, FindFirstPostArgs, sql } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
  __internal: {
    useUds: true,
  },
} as any)

async function main() {
  const args: FindFirstPostArgs = {}
  const x = await prisma.$queryRaw(sql`SELECT 1`)
  console.log(x)
  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
})
