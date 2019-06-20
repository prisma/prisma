import Photon from './@generated/photon'

console.clear()
async function main() {
  const photon = new Photon({
    autoConnect: false,
    debug: {
      library: false,
    },
  })

  const prom = photon.users()
  prom.then(res => {
    console.log('jau1')
    console.log(res)
  })
  prom.then(res => {
    console.log('jau2')
    console.log(res)
  })
}

main().catch(e => console.error(e))
