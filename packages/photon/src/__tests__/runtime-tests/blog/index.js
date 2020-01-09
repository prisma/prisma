const { Photon } = require('@prisma/photon')

module.exports = async () => {
  const photon = new Photon({
    errorFormat: 'colorless',
  })
  await photon.users()
  photon.disconnect()
  await photon.users()
  photon.disconnect()
  photon.connect()
  await photon.disconnect()
  await new Promise(r => setTimeout(r, 200))
  photon.connect()
  await photon.users()
}
