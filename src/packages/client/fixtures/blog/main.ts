import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  errorFormat: 'pretty',
  __internal: {
    engine: {
      enableEngineDebugMode: true,
    },
  },
} as any)

async function main() {
  await prisma.connect()
  const result = await (prisma as any).__internal_triggerPanic(true)
  // const result = await prisma.queryRaw(`SELECT 1`)
  console.log(result)
}

main().catch((e) => {
  console.error(e)
})
