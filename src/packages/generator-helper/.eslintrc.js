const path = require('path')
const config = require('../../../.eslintrc.js')

config.parserOptions.project.push(path.join(__dirname, 'tsconfig.json'))

module.exports = config
