const { getLatestTag } = require('@prisma/fetch-engine')
const pkg = require('../package.json')
const fs = require('fs')
const path = require('path')

async function main() {
  if (process.env.BINARY_DOWNLOAD_VERSION) {
    return
  }
  const tag = await getLatestTag()
  console.log('Updated local engines version to', tag)
  pkg.prisma = pkg.prisma || {}
  pkg.prisma.version = tag
  fs.writeFileSync(
    path.join(__dirname, '../package.json'),
    JSON.stringify(pkg, null, 2),
  )
}

main()
