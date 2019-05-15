import { Photon } from './@generated/photon'

async function main() {
  const prisma = new Photon()
  console.clear()
  const result = await prisma.albums({
    first: 1,
    select: {
      Artist: true,
    },
  })
  console.log(result)
  prisma.close()
}

main().catch(console.error)
