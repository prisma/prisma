const { Photon } = require('@prisma/photon')

module.exports = async () => {
  const photon = new Photon({
    errorFormat: 'colorless',
    __internal: {
      measurePerformance: true,
    },
  })
  await photon.users()
  photon.disconnect()
  await photon.users()
  photon.disconnect()
  photon.connect()
  await photon.disconnect()
  await new Promise(r => setTimeout(r, 200))
  photon.connect()

  const userPromise = photon.users()
  await userPromise
  // @ts-ignore
  const perfResults = userPromise._collectTimestamps.getResults()
  if (Object.keys(perfResults).length === 0) {
    throw Error('measurePerformance is enabled but results object is empty')
  }
  photon.disconnect()
}
