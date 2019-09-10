import Photon from './@generated/photon'

async function main() {
  const photon = new Photon()

  const testData = await photon.users.findMany({
    where: {
      id: {
        notIn: '2c82072a12-4226-99d0-bdc3521a36cc',
      },
    },
  })
  console.log(testData)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
