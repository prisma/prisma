const { download } = require('@prisma/fetch-engine')
download({ binaries: { 'query-engine': __dirname }, ignoreCache: true, printVersion: true })
