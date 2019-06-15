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
  const res = await photon.users({ asd: 123 } as any)
  console.log(res)
  // const user = await photon.users.create({
  //   data: {
  //     email: 'some@mail.com',
  //     location: {
  //       create: {
  //         city: 'Berlin',
  //       },
  //     },
  //     name: 'Tom Tailor',
  //     status: 'active',
  //     favoriteTree: 'YELLOWBIRCH',
  //   },
  // })
  // console.log(user)
  photon.disconnect()
}

main().catch(console.error)
