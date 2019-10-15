import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const count = await photon.users.count()
  console.log(count)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
