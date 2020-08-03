import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
} as any)

async function main() {
  // const result = await (prisma as any).__internal_triggerPanic(true)
  const result = await prisma.$queryRaw(`SELECT 1`)
  console.log(result)
}

main().catch((e) => {
  console.error(e)
})
