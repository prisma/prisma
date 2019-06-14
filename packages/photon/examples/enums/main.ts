import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    hooks: {
      beforeRequest: args => {
        console.log(args)
      },
    },
  })

  console.clear()
  const user = await photon.ppusers.create({
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
