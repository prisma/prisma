import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const testData = await photon.users.count()
  console.log(testData)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
