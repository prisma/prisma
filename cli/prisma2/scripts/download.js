const { download } = require('@prisma/fetch-engine')
const pkg = require('../package.json')
const fs = require('fs')
const path = require('path')
const pkgUp = require('pkg-up')
const Debug = require('debug')
const debug = Debug('prisma2:download')

const binaryPath = eval(`require('path').join(__dirname, '../')`)

const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'

download({
  binaries: {
    'query-engine': binaryPath,
    'migration-engine': binaryPath,
    'introspection-engine': binaryPath,
  },
  showProgress: true,
  version,
})

// if we are in a Now context, ensure that `prisma2 generate` is in the postinstall hook
if (process.env.INIT_CWD && process.env.NOW_BUILDER) {
  ensurePostInstall().catch(e => {
    debug(e)
  })
}

async function ensurePostInstall() {
  const appPkg = path.resolve(process.env.INIT_CWD, 'package.json')
  if (fs.existsSync(appPkg)) {
    ensurePostInstallPackage(appPkg)
  } else {
    const pkgPath = await pkgUp({
      cwd: path.join(process.cwd(), '..'),
    })
    if (pkgPath) {
      ensurePostInstallPackage(pkgPath)
    }
  }
}

function ensurePostInstallPackage(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

  pkg.scripts = pkg.scripts || {}

  if (!pkg.scripts.postinstall) {
    pkg.scripts.postinstall = 'prisma2 generate'
  } else {
    pkg.scripts.postinstall = `prisma2 generate && ${pkg.scripts.postinstall}`
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
}
