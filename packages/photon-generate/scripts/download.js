const { ensureBinaries } = require('@prisma/fetch-engine')
const path = require('path')
const debug = require('debug')('download')
// Until https://github.com/zeit/ncc/issues/390 is resolved we have to do this 🙈
const runtimePath = eval(`path.join(__dirname, '../runtime')`)
debug(`Downloading binaries to ${runtimePath}`)
ensureBinaries(runtimePath)
