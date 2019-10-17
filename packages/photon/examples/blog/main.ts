import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const before = Date.now()
  await photon.posts.create({
    data: {
      published: false,
      title: 'Some Title',
    },
  })
  const result = await photon.posts()
  console.log(result, Date.now() - before)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
