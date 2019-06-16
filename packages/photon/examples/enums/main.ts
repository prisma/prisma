import Photon from './@generated/photon'
// var wtf = require('wtfnode')

async function main() {
  let photons: Photon[] = []
  for (let i = 0; i < 15; i++) {
    const photon = new Photon()

    const result = await photon.users({ first: 1 })
    console.log(result)
    photons.push(photon)
  }

  photons.forEach(p => p.disconnect())
}

main().catch(console.error)
