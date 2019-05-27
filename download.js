const { ensureMigrationBinary } = require('@prisma/fetch-engine')
const debug = require('debug')('download')
debug(`Downloading binaries to ${__dirname}`)
ensureMigrationBinary(__dirname)
