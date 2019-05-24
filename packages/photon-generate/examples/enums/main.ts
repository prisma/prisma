import { Photon, OrderByArg } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  const user = await photon.users({
    where: {
      posts: {
        every: {
          name: null,
        },
      },
    },
  } as any)
}

main().catch(console.error)
