import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon({
    // debug: true,
  })
  await photon.connect()

  const result = await photon.blogs.create({
    data: {
      name: 'Blog Name',
      viewCount: 100,
    },
  })

  console.log(result)
}

main().catch(console.error)
