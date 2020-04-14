const { getLatestAlphaTag } = require('@prisma/fetch-engine')
const pkg = require('../package.json')
const fs = require('fs')
const path = require('path')

async function main() {
  const tag = await getLatestAlphaTag()
  console.log('Updated local engines version to', tag)
  pkg.prisma = pkg.prisma || {}
  pkg.prisma.version = tag
  fs.writeFileSync(
    path.join(__dirname, '../package.json'),
    JSON.stringify(pkg, null, 2),
  )
}

main()
