import Photon from './@generated/photon'

console.clear()
async function main() {
  const photon = new Photon({
    autoConnect: false,
    debug: {
      library: true,
    },
  })

  // const x = await photon.users.update({
  //   where: {
  //     id: 5,
  //   },
  //   data: {

  //   },
  // })

  // console.log(x)
  const prom = photon.users()
  prom.then(res => {
    console.log('jau')
    console.log(res)
  })
  prom.then(res => {
    console.log('jau')
    console.log(res)
  })
}

main().catch(e => console.error(e))
