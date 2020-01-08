import { Photon } from '@prisma/photon'

async function main() {
  const photon = new Photon()

  await photon.users.create({
    data: {
      email: 'a@a.de',
      name2: 'Bobby Brown',
    },
  } as any)

  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
