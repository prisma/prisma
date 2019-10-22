import { Photon } from './@generated/photon'

async function main() {
  const photon = new Photon()

  const before = Date.now()
  const post = await photon.posts.findOne({
    where: {
      id: 'asd',
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

const x = {
  where: e => (e.email.endsWith('@gmail.com'), e.name.startsWith('Bob')),
}
