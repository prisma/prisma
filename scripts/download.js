const { download } = require('@prisma/fetch-engine')
const path = require('path')
download({ binaries: { 'migration-engine': path.join(__dirname, '../') } })
