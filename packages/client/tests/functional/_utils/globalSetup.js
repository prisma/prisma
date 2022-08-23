'use strict'
const glob = require('globby')
const fs = require('fs-extra')
const { setupQueryEngine } = require('../../commonUtils/setupQueryEngine')

module.exports = async () => {
  await setupQueryEngine()

  // we clear up all the files before we run the tests that are not type tests
  const ignorePatternsIndex = process.argv.indexOf('--testPathIgnorePatterns')
  const ignorePatternsValue = process.argv[ignorePatternsIndex + 1]

  if (ignorePatternsValue === 'typescript') {
    glob
      .sync('./**/.generated/', {
        onlyDirectories: true,
        dot: true,
      })
      .forEach((dir) => fs.removeSync(dir, { recursive: true }))
  }
}
