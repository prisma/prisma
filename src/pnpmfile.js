const fs = require('fs')
const path = require('path')

module.exports = {
  hooks: {
    readPackage,
  },
}
const log = 'hi'
fs.appendFileSync(path.join(__dirname, 'logs.txt'), `hell\n`)

function readPackage(pkg, context) {
  fs.appendFileSync(path.join(__dirname, 'logs.txt'), `${pkg.name}\n`)
  // Override the manifest of foo@1 after downloading it from the registry
  // Replace all dependencies with bar@2
  const packages = ['@prisma/studio-server', '@prisma/studio-pcw']
  if (packages.includes(pkg.name)) {
    const log = `package ${pkg.name}\n`
    console.log(log)
    context.log(log)
    fs.appendFileSync(path.join(__dirname, 'logs.txt'), log)
  }

  return pkg
}
