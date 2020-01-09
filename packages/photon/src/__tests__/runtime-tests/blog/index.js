const { Photon } = require('@prisma/photon')

module.exports = async () => {
  const photon = new Photon({
    errorFormat: 'colorless',
  })
  await photon.users()
}
