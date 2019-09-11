import Photon from './@generated/photon'
import path from 'path'

async function main() {
  const photon = new Photon({
    datasources: {
      db: `file:${path.join(__dirname, 'dev2.db')}`
    }
  })

  const testData = await photon.users.findMany()
  console.log(testData)
  photon.disconnect()
}

main().catch(e => {
  console.error(e)
})
