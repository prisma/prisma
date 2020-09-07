const { download } = require('@prisma/fetch-engine')
download({ binaries: { 'query-engine': __dirname }, printVersion: true })
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
