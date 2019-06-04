import { Photon, OrderByArg } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  const user = await photon.users({
    // where: {
    // location: {
    //   AND: {
    //     AND: {
    //       // id: 5,
    //     },
    //   },
    // },
    // posts: {
    //   every: {
    //     NOT: {
    //       name: '',
    //     },
    //   },
    // },
    // },
  })
}

main().catch(console.error)
