const Debug = require('debug')
const path = require('path')
const globalDirs = require('global-dirs')
const { drawBox } = require('@prisma/sdk/dist/drawBox')
const isInstalledGlobally = require('is-installed-globally')
const debug = Debug('preinstall')

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
  const prismaInstalledGlobally = isPackageInstalledGlobally('prisma')
  if (prismaInstalledGlobally) {
    return {
      ...prismaInstalledGlobally,
      name: 'prisma',
    }
  }

  const prisma2InstalledGlobally = isPackageInstalledGlobally('prisma2')
  if (prisma2InstalledGlobally) {
    return {
      ...prisma2InstalledGlobally,
      name: 'prisma2',
    }
  }

  return null
}

const b = str => BOLD + str + RESET
const white = str => WHITE_BRIGHT + str + RESET

// When running in npx, npm puts this package into a /_npx/ folder. Tested on Win, Mac, Linux
if (__dirname.includes('_npx')) {
  process.exit(0)
}

if (!isInstalledGlobally) {
  process.exit(0)
}

const installedGlobally = prismaIsInstalledGlobally()
debug({ installedGlobally })
if (!installedGlobally) {
  process.exit(0)
}

const pkg = require(installedGlobally.pkgPath)
const parts = pkg.version.split('-')
const isAlpha = parts.length > 1 ? parts[1].split('.') === 'alpha' : false

let message
if (installedGlobally.name === 'prisma2') {
  message = `
The package ${white('prisma2')} has been renamed to ${white('@prisma/cli')}.

Please uninstall ${white('prisma2')} globally first.
Then install ${white('@prisma/cli')} to continue using ${b('Prisma 2.0')}:

   # Uninstall old CLI
   ${white(installedGlobally.pkgManager === 'yarn' ? 'yarn global remove prisma2' : 'npm uninstall -g prisma2')}

   # Install new CLI
   ${white(`npm install @prisma/cli${isAlpha ? '@alpha' : ''} --save-dev`)}

   # Invoke via npx
   ${white('npx prisma --help')}

Learn more here: https://pris.ly/preview025
`
} else {
  message = `
You seem to have a global installation of Prisma 1 package ${white('prisma')}. 
As Prisma 2 uses the same executable ${white('prisma')}, this would lead to a conflict.

To keep using Prisma 1, install the new package ${white('prisma1')} that we created.
It exposes the executable ${white('prisma1')}.
  
   # Uninstall old Prisma 1 CLI
   ${white(installedGlobally.pkgManager === 'yarn' ? 'yarn global remove prisma' : 'npm uninstall -g prisma')}

   # Install new Prisma 1 CLI
   ${white(installedGlobally.pkgManager === 'yarn' ? 'yarn global add prisma1' : 'npm install -g prisma1')}

   # Use the Prisma 1 CLI
   ${white('prisma1 --help')}

Then you can install Prisma 2:

   # Install Prisma 2 CLI
   ${white(`npm install @prisma/cli${isAlpha ? '@alpha' : ''} --save-dev`)}
   
   # Invoke via npx
   ${white('npx prisma --help')}

Learn more here: https://pris.ly/prisma1
`
}

console.error(drawBox({ str: message, verticalPadding: 1, horizontalPadding: 3 }))
process.exit(1)
