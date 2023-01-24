const fs = require('fs')
const path = require('path')
const pkgUp = require('pkg-up')
const Debug = require('debug')

const debug = Debug('prisma:install')
const pkg = require('../package.json')

const pkgName = pkg.name

// if we are in a Vercel (previously named Zeit Now) context (because NOW_BUILDER is truthy)
// ensure that `prisma generate` is ran in the postinstall hook
// if (process.env.INIT_CWD && process.env.NOW_BUILDER) {
//   ensurePostInstall().catch((e) => {
//     debug(e)
//   })
// }

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

function addPostInstallHook(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  // only update package.json if prisma is a dependency or devDependency
  if (!pkg.dependencies[pkgName] && !pkg.devDependencies[pkgName]) {
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
