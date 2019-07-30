import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      library: false,
    },
  })

  // await photon.connect()

  // const prom = await photon.users()
  // console.log(prom)

  const result = await photon.order_Items()

  console.log(result)
}

main().catch(e => {
  console.error(e)
})
