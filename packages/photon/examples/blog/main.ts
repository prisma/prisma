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
  const result = await photon.posts.create({
    data: {
      data: 'asd',
      user: {
        connect: {
          id: '42ad4f8c-41f9-477b-9abe-a43d6df669f1',
        },
      },
    },
    select: {
      id: true,
      user: {
        select: { username: true },
      },
    },
  })
  result.user.username
  console.log(result)
}

main().catch(e => console.error(e))
