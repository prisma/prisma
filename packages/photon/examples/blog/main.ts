import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const before = Date.now()
  const post = await photon.posts.findMany({
    where: {},
    include: {
      author: true,
    },
  })
  console.log(post)
  // console.log(result, Date.now() - before)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
