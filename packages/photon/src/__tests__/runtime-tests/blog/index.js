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
  photon.disconnect()
  photon.connect()
  await photon.users()
}
