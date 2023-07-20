// @ts-check
const { drawBox } = require('@prisma/internals/dist/utils/drawBox')

export function main() {
  // process.version (e.g. `v16.0.0`)
  printMessageAndExitIfUnsupportedNodeVersion(process.version)
}

export function printMessageAndExitIfUnsupportedNodeVersion(nodeVersion) {
  const nodeVersionAsParts = nodeVersion.split('.')
  // `.slice(1)` removes `v` from `v16`
  const nodeMajorVersion = parseInt(nodeVersionAsParts[0].slice(1))
  const nodeMinorVersion = parseInt(nodeVersionAsParts[1])

  if (nodeMajorVersion < 16 || (nodeMajorVersion === 16 && nodeMinorVersion < 13)) {
    console.error(
      drawBox({
        str: `Prisma only supports Node.js >= 16.13.\nPlease upgrade your Node.js version.`,
        height: 2,
        width: 48,
        horizontalPadding: 4,
      }),
    )
    process.exit(1)
  }
}
