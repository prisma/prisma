import { Photon, UserOrderByInput, Tree } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  await photon.users.create({
    // data: '',
    data: {
      nicknames: {
        set: ['name1', 'mane2'],
      },
      // name: '',
      email: '',
      // favoriteTree: Tree.BlackAsh,
    },
    select: {
      location: {
        select: {
          id: false,
        },
      },
    },
  } as any)
  await photon.users({
    where: {
      favoriteTree_in: [Tree.Arborvitae, Tree.BlackAsh],
    },
  })
}

main().catch(console.error)
