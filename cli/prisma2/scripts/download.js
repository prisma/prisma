const { download } = require('@prisma/fetch-engine')
const fs = require('fs')
const path = require('path')
const pkgUp = require('pkg-up')
const Debug = require('debug')
const debug = Debug('prisma2:download')

const binaryDir = eval(`require('path').join(__dirname, '../')`)
const pkg = eval(`require(require('path').join(binaryDir, 'package.json'))`)

const version = (pkg && pkg.prisma && pkg.prisma.version) || 'latest'

const lockFile = path.join(binaryDir, 'download-lock')

let createdLockFile = false
async function main() {
  if (fs.existsSync(lockFile) && JSON.parse(fs.readFileSync(lockFile) > Date.now() - 20000)) {
    debug(`Lock file already exists, so we're skipping the download of the prisma2 binaries`)
  } else {
    createLockFile()
    await download({
      binaries: {
        'query-engine': binaryDir,
        'migration-engine': binaryDir,
        'introspection-engine': binaryDir,
      },
      showProgress: true,
      version,
      failSilent: true,
    }).catch(e => debug(e))

    cleanupLockFile()
  }
}

function createLockFile() {
  createdLockFile = true
  fs.writeFileSync(lockFile, Date.now())
}

function cleanupLockFile() {
  if (createdLockFile) {
    try {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile)
      }
    } catch (e) {
      debug(e)
    }
  }
}

main()

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
  // only update package.json if @prisma/cli is a dependency or devDependency
  if (!json.dependencies['@prisma/cli'] && !json.devDependencies['@prisma/cli']) {
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

process.on('beforeExit', () => {
  cleanupLockFile()
})

process.once('SIGINT', () => {
  cleanupLockFile()
  process.exit()
})
