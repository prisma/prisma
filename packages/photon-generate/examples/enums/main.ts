import { Photon, UserOrderByInput, Tree, OrderByArg } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  const user = await photon.users({
    orderBy: {
      email: OrderByArg.asc,
      id: 'asc',
    },
  })
  // await photon.users({
  //   where: {
  //     favoriteTree_in: [Tree.Arborvitae, Tree.BlackAsh],
  //   },
  // })
}

main().catch(console.error)
