import { Photon, UserGetSelectPayload } from '@prisma/photon'

async function main() {
  const photon = new Photon()

  const user1 = await photon.users.create({
    data: {
      email:
        'a@a.de2' +
        Math.random()
          .toString(36)
          .substring(2, 15),
      name: 'Bobby Brown',
    },
  })

  console.log(user1)

  photon.disconnect()
  photon.connect()
  photon.disconnect()

  const user2 = await photon.users.create({
    data: {
      email:
        'a@a.de2' +
        Math.random()
          .toString(36)
          .substring(2, 15),
      name: 'Bobby Brown',
    },
  })

  photon.disconnect()

  console.log(user2)
}

main().catch(e => {
  console.error(e)
})
