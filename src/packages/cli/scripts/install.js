const fs = require('fs')
const path = require('path')
const pkgUp = require('pkg-up')
const Debug = require('@prisma/debug')
const debug = Debug('prisma:install')

// if we are in a Now context, ensure that `prisma generate` is in the postinstall hook
if (process.env.INIT_CWD && process.env.NOW_BUILDER) {
  ensurePostInstall().catch((e) => {
    debug(e)
  })
}

async function ensurePostInstall() {
  const initPkgPath = eval(
    `require('path').resolve(process.env.INIT_CWD, 'package.json')`,
  )
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

function addPostInstallHook(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  // only update package.json if @prisma/cli is a dependency or devDependency
  if (!pkg.dependencies['@prisma/cli'] && !pkg.devDependencies['@prisma/cli']) {
    return false
  }

  pkg.scripts = pkg.scripts || {}

  if (!pkg.scripts.postinstall) {
    pkg.scripts.postinstall = `prisma generate || true`
  } else {
    if (!pkg.scripts.postinstall.includes('prisma generate')) {
      pkg.scripts.postinstall = `prisma generate || true && ${pkg.scripts.postinstall}`
    }
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  return true
}
