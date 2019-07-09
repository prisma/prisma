import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    autoConnect: false,
    debug: {
      library: false,
    },
  })

  // process.addListener('SIG')

  // const prom = await photon.users.create({
  //   data: {
  //     username: 'Bob',
  //   },
  // })
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
  const postsByUser = await photon.users.findOne({
    where: {
      email: 'alice@prisma.io',
    },
    select: {
      name: true,
      email: true,
      posts: {
        // here I want only published posts
        where: {
          published: true,
        },
        select: {
          title: true,
          // just for checking query response correctness
          published: true,
        },
      },
    },
  })
}

main().catch(e => console.error(e))
