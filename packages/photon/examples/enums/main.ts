import { Photon, OrderByArg } from './@generated/photon'

async function main() {
  const photon = new Photon()

  console.clear()
  const user = await photon.users.create({
    data: {
      email: 'some@mail.com',
      location: {
        create: {
          city: 'Berlin',
        },
      },
      name: 'Tom Tailor',
      status: 'active',
      favoriteTree: 'YELLOWBIRCH',
    },
  })
  console.log(user)
  photon.disconnect()
}

main().catch(console.error)
