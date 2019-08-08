import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({ debug: true })

  const testData = await photon.users.create({
    data: {
      username: 'post3s',
      // posts: {
      //   create: {
      //     data: 'test',
      //   },
      // },
    },
  })
  console.log(testData)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
