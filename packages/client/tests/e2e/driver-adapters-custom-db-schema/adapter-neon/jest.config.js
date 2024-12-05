const defaultConfig = require('../jest.config')

module.exports = {
  ...defaultConfig,
  setupFiles: './jestSetup.js',
}
