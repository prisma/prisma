const { Photon } = require('@prisma/photon')

module.exports = async () => {
  const photon = new Photon()

  const result = await photon.users({
    where: {
      favoriteTree: {
        in: ['ARBORVITAE'],
      },
    },
  })

  photon.disconnect()
}

if (require.main === module) {
  module.exports()
}
