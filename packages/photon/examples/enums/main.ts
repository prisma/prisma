import { Photon, OrderByArg } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: true,
  })

  console.clear()
  const user = await photon.users.create({
    data: {
      email: 'some@mail.com',
    },
  } as any)
}

main().catch(console.error)
