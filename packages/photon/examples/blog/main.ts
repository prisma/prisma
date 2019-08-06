import Photon from './@generated/photon'

async function main() {
  const photon = new Photon()

  await photon.connect()

  const result0 = await photon.posts()

  console.log(result0.length, 'items in the db')

  const result = await photon.users.deleteMany({
    where: {
      id: 'asd9as0d9ajsd0j',
    },
    // data: {
    //   name: 'asdasd',
    // },
  })

  console.log(result)

  await photon.disconnect()
  process.exit()
}

main().catch(e => {
  console.error(e)
})
