import Photon from './@generated/photon'

async function main() {
  const photon = new Photon()

  const testData = await photon.users.findMany({
    where: {
      id: {
        notIn: '2c8207f9-2a12-4226-99d0-bdc3521a36cc',
      },
    },
  })
  console.log(testData)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
