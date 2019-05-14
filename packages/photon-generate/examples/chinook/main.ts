import { Prisma } from './@generated/prisma'

async function main() {
  const prisma = new Prisma({ debug: true })
  console.clear()
  const result = await prisma.albums.findMany({
    first: 1,
    select: {
      Artist: true,
    },
  })
  console.log(result)
  await prisma.close()
}

main().catch(console.error)
