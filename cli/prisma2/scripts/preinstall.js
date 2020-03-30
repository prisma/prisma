const path = require('path')
const globalDirs = require('global-dirs')
const { drawBox } = require('@prisma/sdk/dist/drawBox')

const BOLD = '\u001b[1m'
const WHITE_BRIGHT = '\u001b[37;1m'
const RESET = '\u001b[0m'

// returns { pkgManager: 'yarn' | 'npm', pkgPath: string } | null
function isInstalledGlobally() {
  try {
    const pkgPath = require.resolve(path.join(globalDirs.yarn.packages, 'prisma2/package.json'))
    return { pkgManager: 'yarn', pkgPath }
  } catch (_) {
    try {
      const pkgPath = require.resolve(path.join(globalDirs.npm.packages, 'prisma2/package.json'))
      return { pkgManager: 'npm', pkgPath }
    } catch (_) {
      //
    }
  }
  return null
}

const b = str => BOLD + str + RESET
const white = str => WHITE_BRIGHT + str + RESET

const installedGlobally = isInstalledGlobally()
if (!installedGlobally) {
  process.exit(0)
}

const pkg = require(installedGlobally.pkgPath)
const parts = pkg.version.split('-')
const isAlpha = parts[1].split('.') === 'alpha'

const message = `
The package ${white('prisma2')} has been renamed to ${white('@prisma/cli')}.

Please uninstall ${white('prisma2')} globally first.
Then install ${white('@prisma/cli')} to continue using ${b('Prisma 2.0')}:

   # Uninstall old CLI
   ${white(isInstalledGlobally.pkgManager === 'yarn' ? 'yarn remove -g prisma2' : 'npm uninstall -g prisma2')}

   # Install new CLI
   ${white(`npm install @prisma/cli${isAlpha ? '@alpha' : ''} --save-dev`)}

   # Invoke via npx
   ${white('npx prisma --help')}

Learn more here: https://pris.ly/preview025
`

console.error(drawBox({ str: message, verticalPadding: 1, horizontalPadding: 3 }))
process.exit(1)
