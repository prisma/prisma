const { download } = require('@prisma/fetch-engine')
const pkg = require('../package.json')

const binaryPath = eval(`require('path').join(__dirname, '../')`)

const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'

download({
  binaries: {
    'query-engine': binaryPath,
    'migration-engine': binaryPath,
  },
  showProgress: true,
  version,
})
