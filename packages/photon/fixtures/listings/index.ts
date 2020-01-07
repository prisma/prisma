import Photon from './@generated/photon'

const photon = new Photon({
  debug: {
    // engine: true,
    // library: true,
  },
})

async function main() {
  // await photon.users.deleteMany({})
  // await photon.connect()
  const x = await photon.users.findMany()
  // console.log(x)
  for (let i = 0; i < 1; i++) {
    console.log('trying')
    const user1 = await photon.users.create({
      data: {
        email: 'bob@example.com',
        name: 'Bob Loblaw',
        password: 'test',
        listings: {
          create: [
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
            {
              slug: 'slug',
              condition: 'AS_NEW',
              description: 'desc',
              location: 'loc',
              price: 10,
            },
          ],
        },
      },
    })

    console.log({ user1 })

    const result = await photon.users.findMany({
      include: { listings: true },
      first: 1000,
    })
    console.log(result)
  }
}

main()
  .catch(e => console.log(e))
  .finally(async () => {
    const before = Date.now()
    console.log(`Telling rust to shut down`)
    await photon.disconnect()
    const after = Date.now()
    console.log(`Nodejs kill done after ${after - before}ms`)
  })
