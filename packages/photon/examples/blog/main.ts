import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      library: true,
    },
  })

  const x = await photon.authors.create({
    data: {
      name: 'Mark',
      posts: {
        create: {
          title: 'some title',
          tags: {
            set: ['asd'],
          },
        },
      },
      blog: {
        create: {
          name: 'Blog',
          viewCount: 5,
        },
      },
    },
  })
  console.log(x)
}

main().catch(console.error)
