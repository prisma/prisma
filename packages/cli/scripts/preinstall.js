const { drawBox } = require('@prisma/internals/dist/utils/drawBox')

export function main() {
  // process.version (e.g. `v16.0.0`)
  const nodeVersions = process.version.split('.')
  // `.slice(1)` removes `v` from `v16`
  const nodeMajorVersion = parseInt(nodeVersions[0].slice(1))
  const nodeMinorVersion = parseInt(nodeVersions[1])
  if (nodeMajorVersion < 16 || (nodeMajorVersion === 16 && nodeMinorVersion < 13)) {
    console.error(
      drawBox({
        str: `Prisma only supports Node.js >= 16.13`,
        verticalPadding: 1,
        horizontalPadding: 3,
      }),
    )
    process.exit(1)
  }
}
