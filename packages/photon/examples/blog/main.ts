import { Photon } from '@prisma/photon'

async function main() {
  const photon = new Photon()

  const posts = await photon.posts()

  console.log(posts)
  // console.log(result, Date.now() - before)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
