import Photon from './@generated/photon'

async function main() {
  const photon = new Photon()

  const testData = await photon.users.create({
    data: {
      username: 'posts',
      // posts: {
      //   create: {
      //     data: 'test',
      //   },
      // },
    },
  })
}

main().catch(e => {
  console.error(e)
})
