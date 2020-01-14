import { Photon } from './@prisma/photon'

async function main() {
  const photon = new Photon({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'info' },
    ],
  })

  photon.on('query', q => {
    console.log('query', q)
  })

  photon.on('info', q => {
    console.log('info', q)
  })

  const users = await photon.users()

  // console.log(users)
}

main().catch(e => {
  console.error(e)
})
