import { Photon } from './@generated/photon'

async function main() {
  const prisma = new Photon({ debug: true })
  console.clear()
  const result = await prisma.albums({
    first: 1,
    select: {
      Artist: {
        select: {},
      },
      Tracks: {
        first: 2,
      },
    },
  })
  console.dir(result, { depth: null })
  prisma.close()
}

main().catch(console.error)
