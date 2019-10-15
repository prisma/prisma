import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const bars = await photon.users.findMany({
    where: {
      likedArticles: {
        some: {
          likedBy: {
            some: {
              AND: {
                asd,
              },
            },
          },
        },
      },
    },
  })
  console.log(bars)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
