import Photon from './@generated/photon'

async function main() {
  const photon = new Photon({
    debug: {
      library: false,
    },
    datasources: {
      db: 'file:db/migration_engine3.db',
    },
  })

  await photon.connect()

  // const prom = await photon.users()
  // console.log(prom)

  const result = await photon.posts()

  console.log(result)
}

main().catch(e => {
  console.error(e)
})
