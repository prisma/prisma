import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      engine: true,
    },
  })

  await photon.connect()

  // const prom = await photon.users()
  // console.log(prom)

  const result0 = await photon.posts()

  console.log(result0.length)
  console.log('Doing nested create now...')

  const result = await photon.users.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob Lowbob',
      posts: {
        create: [
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
          {
            title: 'Title',
            published: true,
            randomDate: new Date(),
            content: 'Some huuuge content',
          },
        ],
      },
    },
  })

  console.log(result)

  await photon.disconnect()
  process.exit()
}

main().catch(e => {
  console.error(e)
})
