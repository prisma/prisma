import { Photon, OrderByArg } from './@generated/photon'

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
}

main().catch(console.error)
