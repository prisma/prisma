import { Prisma } from './@generated/prisma'
import { performance } from 'perf_hooks'

async function main() {
  const prisma = new Prisma({ debug: false })
  await prisma.artists.findMany({
    // first: 10,
  })
  const before = performance.now()
  const result = await prisma.artists.findMany({
    // first: 10,
  })

  // console.log(result)
  console.log(`Done in ${(performance.now() - before).toFixed(2)}ms`)
}

main().catch(console.error)
