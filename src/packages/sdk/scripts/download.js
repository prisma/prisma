const { download } = require('@prisma/fetch-engine')

// Until https://github.com/zeit/ncc/issues/390 is resolved we have to do this 🙈
const runtimePath = eval(`require('path').join(__dirname, '../')`)

const pkg = eval(`require(require('path').join(__dirname, '../package.json'))`)

const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'

download({
  binaries: {
    'query-engine': runtimePath,
    'introspection-engine': runtimePath,
    'migration-engine': runtimePath,
    'prisma-fmt': runtimePath,
  },
  showProgress: true,
  printVersion: true,
  ignoreCache: true,
  version,
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
