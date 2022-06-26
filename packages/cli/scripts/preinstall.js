const path = require('path')
const globalDirs = require('global-dirs')
const { drawBox } = require('@prisma/internals/dist/utils/drawBox')
const isInstalledGlobally = require('is-installed-globally')

const BOLD = '\u001b[1m'
const WHITE_BRIGHT = '\u001b[37;1m'
const RESET = '\u001b[0m'

// returns { pkgManager: 'yarn' | 'npm', pkgPath: string } | null
function isPackageInstalledGlobally(name) {
  try {
    const pkgPath = require.resolve(path.join(globalDirs.yarn.packages, `${name}/package.json`))
    return { pkgManager: 'yarn', pkgPath }
  } catch (_) {
    try {
      const pkgPath = require.resolve(path.join(globalDirs.npm.packages, `${name}/package.json`))
      return { pkgManager: 'npm', pkgPath }
    } catch (_) {
      //
    }
  }
  return null
}

function prismaIsInstalledGlobally() {
  const prisma2InstalledGlobally = isPackageInstalledGlobally('prisma2')
  if (prisma2InstalledGlobally) {
    return {
      ...prisma2InstalledGlobally,
      name: 'prisma2',
    }
  }

  return null
}

const b = (str) => BOLD + str + RESET
const white = (str) => WHITE_BRIGHT + str + RESET

export function main() {
  const nodeVersions = process.version.split('.')
  const nodeMajorVersion = parseInt(nodeVersions[0].slice(1))
  const nodeMinorVersion = parseInt(nodeVersions[1])
  if (nodeMajorVersion < 14 || (nodeMajorVersion === 14 && nodeMinorVersion < 17)) {
    console.error(
      drawBox({
        str: `Prisma only supports Node.js >= 14.17`,
        verticalPadding: 1,
        horizontalPadding: 3,
      }),
    )
    process.exit(1)
  }
  // When running in npx, npm puts this package into a /_npx/ folder. Tested on Win, Mac, Linux
  if (__dirname.includes('_npx')) {
    process.exit(0)
  }

  if (!isInstalledGlobally) {
    process.exit(0)
  }

  const installedGlobally = prismaIsInstalledGlobally()
  if (!installedGlobally) {
    process.exit(0)
  }

  const pkg = require(installedGlobally.pkgPath)
  const parts = pkg.version.split('-')
  const isDev = parts.length > 1 ? parts[1].split('.') === 'dev' : false

  let message
  if (installedGlobally.name === 'prisma2') {
    message = `
The package ${white('prisma2')} has been renamed to ${white('prisma')}.

Please uninstall ${white('prisma2')} globally first.
Then install ${white('prisma')} to continue using ${b('Prisma 2+')}:

   # Uninstall old CLI
   ${white(installedGlobally.pkgManager === 'yarn' ? 'yarn global remove prisma2' : 'npm uninstall -g prisma2')}

   # Install new CLI
   ${white(`npm install prisma${isDev ? '@dev' : ''} --save-dev`)}

   # Invoke via npx
   ${white('npx prisma --help')}

Learn more here: https://pris.ly/preview025
`
  }

  console.error(drawBox({ str: message, verticalPadding: 1, horizontalPadding: 3 }))
  process.exit(1)
}
