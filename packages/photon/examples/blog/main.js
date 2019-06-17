const Photon = require('@generated/photon')

async function main() {
  const photon = new Photon({
    autoConnect: false,
    debug: {
      library: false,
    },
  })

  const users = await photon.users({
    select: {
      id: true,
    },
  })
  console.log(users)
  console.log(Photon.dmmf)

  // const x = await photon.users.update({
  //   where: {
  //     id: 5,
  //   },
  //   data: {

  //   },
  // })

  // console.log(x)
  // const x = await photon.posts
  //   .findOne({
  //     where: {
  //       id: 1,
  //     },
  //   })
  //   .author()
}

main().catch(console.error)
