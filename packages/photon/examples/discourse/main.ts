import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()
  const result = await photon.tags({
    first: 10,
    select: {
      createdAt: false,
      updatedAt: false,
    },
  })
  console.log(result)
  photon.close()
}

main().catch(console.error)
