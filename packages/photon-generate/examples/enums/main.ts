import { Photon, UserOrderByInput, Tree } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  const user = await photon.users({
    where: {
      AND: [
        {
          email: {
            equals: 'a@a.de',
            gt: '0',
          },
          AND: [
            {
              name: {
                equals: '5',
                not: '7',
              },
              OR: [
                {
                  id: {
                    not: '8',
                  },
                },
                {
                  id: {
                    not: '9',
                  },
                },
              ],
            },
          ],
        },
        {
          id: {
            equals: '1',
            gt: '0',
          },
        },
      ],
      // location: {
      //   OR: {
      //     city: {
      //       gt: '10',
      //       not: 'x',
      //     },
      //   },
      // },
    },
  })
  // await photon.users({
  //   where: {
  //     favoriteTree_in: [Tree.Arborvitae, Tree.BlackAsh],
  //   },
  // })
}

main().catch(console.error)
