import { Photon } from '@prisma/photon'

async function main() {
  const photon = new Photon({
    errorFormat: 'pretty',
  })

  await photon.users.create({
    data: {
      email: 'a@a.de',
      name: 'Bobby Brown',
    },
  })

  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
