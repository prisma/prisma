const { drawBox } = require('@prisma/internals/dist/utils/drawBox')
var { red, underline } = require('kleur/colors')

export function main() {
  // process.version (e.g. `v16.0.0`)
  const nodeVersions = process.version.split('.')
  // `.slice(1)` removes `v` from `v16`
  const nodeMajorVersion = parseInt(nodeVersions[0].slice(1))
  const nodeMinorVersion = parseInt(nodeVersions[1])
  if (nodeMajorVersion < 16 || (nodeMajorVersion === 16 && nodeMinorVersion < 13)) {
    console.error(
      drawBox({
        str: `${red('Prisma only supports Node.js >= 16.13.')}\n${underline('Please upgrade your Node.js version.')}`,
        height: 2,
        width: 48,
        horizontalPadding: 4,
      }),
    )
    process.exit(1)
  }
}
