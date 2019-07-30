import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      library: false,
    },
  })

  // await photon.connect()

  // const prom = await photon.users()
  // console.log(prom)

  // const result0 = await photon.posts.findMany({
  //   include: {
  //     author: {
  //       include: {
  //         // posts: true,
  //       },
  //     },
  //   },
  //   // select: {
  //   //   id: true
  //   // }
  //   // first: 5
  // })

  const result = await photon.posts.deleteMany({
    where: {
      id: {
        in: ['d4082b42-b161-11e9-8754-6542abf52968'],
      },
    },
  })

  console.log(result)

  // const result = await photon.posts.create({
  //   data: {
  //     title: '123e4567-e89b-12d3-a456-426655440000',
  //     published: false,
  //     author: {
  //       create: {
  //         email: 'asd@asd.de',
  //       },
  //     },
  //   },
  //   include: {
  //     author: true,
  //   },

  //   // select: {
  //   //   id: true,
  //   //   published: true,
  //   // },

  //   // select: {
  //   //   author: {
  //   //     select: {
  //   //       id: true,
  //   //     },
  //   //   },
  //   // },
  // })
  // .author()
  // .posts({
  //   include: {
  //     author: true,
  //   },
  // })

  // console.log(result)

  // const result = await photon.posts.create({
  //   data: {
  //     data: 'asd',
  //     user: {
  //       connect: {
  //         id: '42ad4f8c-41f9-477b-9abe-a43d6df669f1',
  //       },
  //     },
  //   },
  //   select: {
  //     id: true,
  //     user: {
  //       select: { username: true },
  //     },
  //   },
  // })
  // result.user.username
  // console.log(result)
  // const postsByUser = await photon.users.findOne({
  //   where: {
  //     email: 'alice@prisma.io',
  //   },
  //   select: {
  //     name: true,
  //     email: true,
  //     posts: {
  //       // here I want only published posts
  //       where: {
  //         published: true,
  //       },
  //       select: {
  //         title: true,
  //         // just for checking query response correctness
  //         published: true,
  //       },
  //     },
  //   },
  // })
}

main().catch(e => {
  console.error(e)
})
