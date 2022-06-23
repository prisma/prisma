const path = require('path')

/**
 * To force jest to transpile only certain modules #ESM.
 */
function forceTranspile(names = ['uuid']) {
  return `node_modules/(?!(${names.join('|')})/)/`
}

module.exports = forceTranspile
