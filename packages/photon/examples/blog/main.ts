import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon({
    // debug: true,
  })
  await photon.connect()

  const result = await photon.authors.create({
    data: {
      name: 'Test',
    },
  } as any)

  // return proton.blogs
  //   .findOne({
  //     where: {
  //       id: 5,
  //     },
  //   })
  //   .authors({
  //     asdf: '',
  //   } as any)

  // console.log(result)
}

main().catch(console.error)
