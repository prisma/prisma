const path = require('path')
const { ensureQueryEngineBinary, ensureMigrationBinary } = require('@prisma/fetch-engine')
const pkg = require('../package.json')

const runtimePath = eval(`path.join(__dirname, '../runtime')`)
const migrationBinaryPath = eval(`path.join(__dirname, '../')`)

const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'

ensureQueryEngineBinary(runtimePath, version)
ensureMigrationBinary(migrationBinaryPath, version)
