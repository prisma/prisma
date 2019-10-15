import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const bars = await photon.users.findMany({
    where: {
      OR: [
        {
          name: {
            startsWith: 'x',
          },
          // posts: {
          //   some: {
          //     id: 'test',
          //   },
          // },
        },
      ],
    },
  })
  console.log(bars)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
