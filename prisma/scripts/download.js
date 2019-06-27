const path = require('path')
const {
  ensureBinaries,
  ensureMigrationBinary,
} = require('@prisma/fetch-engine')

const runtimePath = eval(`path.join(__dirname, '../runtime')`)
const migrationBinaryPath = eval(`path.join(__dirname, '../')`)
ensureBinaries(runtimePath)
ensureMigrationBinary(migrationBinaryPath)
