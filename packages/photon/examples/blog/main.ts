import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      library: true,
    },
  })

  const a = await photon.posts
    .create({
      data: {
        author: {
          create: {
            email: 'a@a.de',
            name: 'A name',
          },
        },
        title: 'Mitle',
      },
    })
    .author()
    .profile()
    .user()
    .profile()

  // const x = await photon.posts
  //   .findOne({
  //     where: {
  //       id: 1,
  //     },
  //   })
  //   .author()
}

main().catch(console.error)
