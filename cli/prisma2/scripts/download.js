const { download } = require('@prisma/fetch-engine')
const fs = require('fs')
const path = require('path')
const pkgUp = require('pkg-up')
const Debug = require('debug')
const debug = Debug('prisma2:download')

const binaryPath = eval(`require('path').join(__dirname, '../')`)
const pkg = eval(`require(require('path').join(binaryPath, 'package.json'))`)

const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'

download({
  binaries: {
    'query-engine': binaryPath,
    'migration-engine': binaryPath,
    'introspection-engine': binaryPath,
  },
  showProgress: true,
  version,
  failSilent: true,
})

// if we are in a Now context, ensure that `prisma2 generate` is in the postinstall hook
if (process.env.INIT_CWD && process.env.NOW_BUILDER) {
  ensurePostInstall().catch(e => {
    debug(e)
  })
}

async function ensurePostInstall() {
  const initPkgPath = eval(`require('path').resolve(process.env.INIT_CWD, 'package.json')`)
  if (fs.existsSync(initPkgPath)) {
    if (addPostInstallHook(initPkgPath)) {
      return
    }
  } else {
    // walk up all the way
    let cwd = path.join(process.cwd(), '..')
    let pkgPath
    do {
      pkgPath = await pkgUp({
        cwd,
      })
      cwd = path.join(pkgPath, '../..')
    } while (pkgPath && !addPostInstallHook(pkgPath))
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function addPostInstallHook(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  // only update package.json if prisma2 is a dependency or devDependency
  if (!json.dependencies['prisma2'] && !json.devDependencies['prisma2']) {
    return false
  }

  pkg.scripts = pkg.scripts || {}

  if (!pkg.scripts.postinstall) {
    pkg.scripts.postinstall = `prisma2 generate || true`
  } else {
    if (!pkg.scripts.postinstall.includes('prisma2 generate')) {
      pkg.scripts.postinstall = `prisma2 generate || true && ${pkg.scripts.postinstall}`
    }
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  return true
}
