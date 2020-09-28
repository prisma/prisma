const { download } = require('@prisma/fetch-engine')
const { getLatestTag } = require('@prisma/fetch-engine')
const pkg = require('../package.json')
const fs = require('fs')
const path = require('path')

// Until https://github.com/zeit/ncc/issues/390 is resolved we have to do this 🙈
const runtimePath = eval(`require('path').join(__dirname, '../')`)

async function main() {
  const tag = await getLatestTag()
  pkg.prisma = pkg.prisma || {}
  pkg.prisma.version = tag

  fs.writeFileSync(
    path.join(__dirname, '../package.json'),
    JSON.stringify(pkg, null, 2),
  )

  await download({
    binaries: {
      'query-engine': runtimePath,
    },
    showProgress: true,
    printVersion: true,
    ignoreCache: true,
    version: tag
  }).catch((e) => {
    console.error(e)
    process.exit(1)
  })

}

main()
