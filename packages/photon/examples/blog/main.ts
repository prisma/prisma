import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      // library: true,
    },
  })

  const before = Date.now()
  const post = await photon.posts.findMany({
    where: {
      author: null,
    },
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
