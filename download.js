const { download } = require('@prisma/fetch-engine')
download({ binaries: { 'migration-engine': __dirname } })
