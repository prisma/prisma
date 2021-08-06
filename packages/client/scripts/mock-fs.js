const { patchFs } = require('fs-monkey')
const fs = require('fs')

module.exports = function mockFs(fileMap) {
  const originalFsRead = fs.readFileSync

  const myFs = {
    readFileSync: (fileName, ...args) => {
      return fileMap[fileName] || originalFsRead.call(fs, fileName, ...args)
    },
  }

  patchFs(myFs)
}
