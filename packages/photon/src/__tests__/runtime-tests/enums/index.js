const { Photon } = require('@prisma/photon')
const assert = require('assert')

module.exports = async () => {
  const photon = new Photon({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'info',
      },
    ],
  })

  const queryEvents = []

  photon.on('query', e => queryEvents.push(e))

  const result = await photon.users({
    where: {
      favoriteTree: {
        in: ['ARBORVITAE'],
      },
    },
  })

  await photon.disconnect()

  assert(queryEvents.length > 0)
}

if (require.main === module) {
  module.exports()
}
