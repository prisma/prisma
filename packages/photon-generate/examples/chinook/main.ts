import { Photon } from './@generated/photon'

async function main() {
  const prisma = new Photon({ debug: false })
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
