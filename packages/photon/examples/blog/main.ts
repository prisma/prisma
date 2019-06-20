import Photon from '@generated/photon'

console.clear()
async function main() {
  const photon = new Photon(/*{
    autoConnect: false,
    debug: {
      library: false,
    },
  }*/)

  const testData = await photon.users.create({
    data: {
      username: 'harshit',
      posts: {
        create: {
          data: 'test',
        },
      },
    },
  })
  console.log(testData)

  // const x = await photon.users.update({
  //   where: {
  //     id: 5,
  //   },
  //   data: {

  //   },
  // })

  // console.log(x)
  // const x = await photon.posts
  //   .findOne({
  //     where: {
  //       id: 1,
  //     },
  //   })
  //   .author()
}

main().catch(e => console.error(e))
