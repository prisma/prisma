import { Photon } from '@prisma/photon'

async function main() {
  const photon = new Photon({
    errorFormat: 'colorless',
  })

  const posts = await photon.posts({
    where: {
      x: 1,
    },
  } as any)

  console.log(posts)
  // console.log(result, Date.now() - before)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
