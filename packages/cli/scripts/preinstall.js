const { drawBox } = require('@prisma/internals/dist/utils/drawBox')

export function main() {
  // process.version (e.g. `v16.0.0`)
  const nodeVersions = process.version.split('.')
  // `.slice(1)` removes `v` from `v16`
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
}
