'use strict'
const glob = require('globby')
const fs = require('fs-extra')
const { setupQueryEngine } = require('../../_utils/setupQueryEngine')

module.exports = async (globalConfig) => {
  process.env['JEST_MAX_WORKERS'] = globalConfig.maxWorkers // expose info to test setup

  await setupQueryEngine()

  // we clear up all the files before we run the tests that are not type tests
  const ignorePatternsIndex = process.argv.indexOf('--testPathIgnorePatterns')
  const ignorePatternsValue = process.argv[ignorePatternsIndex + 1]

  if (ignorePatternsValue === 'typescript') {
    glob
      .sync(['./tests/functional/**/.generated/', './tests/functional/**/node_modules/'], {
        onlyDirectories: true,
        dot: true,
      })
      .forEach((dir) => fs.removeSync(dir, { recursive: true }))
  }
}
