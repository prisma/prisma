'use strict'
const pkg = require('./package.json')
const engineVersion = require('@prisma/engines-version').enginesVersion

module.exports = {
  client: pkg.version,
  engine: engineVersion,
}
