import { Photon, UserOrderByInput, Tree } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  const user = await photon.users({
    where: {
      email: {},
    },
  } as any)
  // await photon.users({
  //   where: {
  //     favoriteTree_in: [Tree.Arborvitae, Tree.BlackAsh],
  //   },
  // })
}

main().catch(console.error)
