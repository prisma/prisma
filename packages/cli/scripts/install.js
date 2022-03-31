const fs = require('fs')
const path = require('path')
const pkgUp = require('pkg-up')
const Debug = require('debug')
const debug = Debug('prisma:install')
const pkg = require('../package.json')
const pkgName = pkg.name

// if we are in a Now context, ensure that `prisma generate` is in the postinstall hook
if (process.env.INIT_CWD) {
  ensurePostInstall().catch((e) => {
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

function addPostInstallHook(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  // only update package.json if prisma is a dependency or devDependency
  if (!pkg.dependencies[pkgName] && !pkg.devDependencies[pkgName]) {
    return false
  }

  pkg.scripts = pkg.scripts || {}

  if (!pkg.scripts['vercel-build']) {
    pkg.scripts['vercel-build'] = `(prisma generate || true)`
  } else {
    if (!pkg.scripts['vercel-build'].includes('prisma generate')) {
      pkg.scripts['vercel-build'] = `(prisma generate || true) && ${pkg.scripts['vercel-build']}`
    }
  }

  console.log('POSTINSTALL HAS HAPPENED', pkgPath)
  console.info('POSTINSTALL HAS HAPPENED', pkgPath)
  console.error('POSTINSTALL HAS HAPPENED', pkgPath)

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
  return true
}
