/**
 * To force jest to transpile only certain modules #ESM.
 */
function forceTranspile(names = ['uuid', 'sql-template-tag']) {
  return `/node_modules/.*?/node_modules/(?!(${names.join('|')})/)`
}

module.exports = forceTranspile
