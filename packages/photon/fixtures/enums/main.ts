import { Photon } from './@prisma/photon'

async function main() {
  const photon = new Photon()

  // const result = await photon.users.create({
  //   data: {
  //     email: 'a@a.de',
  //     favoriteTree: 'ARBORVITAE',
  //     name: 'Say my name',
  //     permissions: 'ADMIN',
  //     status: 'A status',
  //   },
  // })

  const result = await photon.users({
    where: {
      favoriteTree: {
        in: ['ARBORVITAE'],
      },
    },
  })
  console.log(result)
  photon.disconnect()
}

main().catch(console.error)
