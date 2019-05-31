import { Photon, Artist } from './@generated/photon'

async function main() {
  const prisma = new Photon({ debug: true })
  console.clear()
  const result = await prisma.artists({
    where: {
      Albums: {
        some: {
          Tracks: {
            some: {
              AND: {
                UnitPrice: 5,
                Playlists: {
                  some: {
                    Tracks: {
                      some: {
                        Name: '',
                        Genre: {
                          id: 5,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  console.dir(result, { depth: null })
  prisma.close()
}

main().catch(console.error)
