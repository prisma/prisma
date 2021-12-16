const path = require('path')
const config = require('../../.eslintrc.js')

config.parserOptions.project.push(path.join(__dirname, 'tsconfig.eslint.json'))
module.exports = config
