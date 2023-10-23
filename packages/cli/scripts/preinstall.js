const process = require('node:process')
// @ts-check
const { drawBox } = require('@prisma/internals/dist/utils/drawBox')

export function main() {
  // Node.js version, without the `v` prefix (e.g. `16.13.0`)
  const nodeVersion = process.versions.node

  printMessageAndExitIfUnsupportedNodeVersion(nodeVersion)
}

function extractSemanticVersionParts(version) {
  return version
    .split('.')
    .slice(0, 2) // only major and minor version
    .map((v) => parseInt(v, 10))
}

export function printMessageAndExitIfUnsupportedNodeVersion(nodeVersion) {
  const MIN_NODE_VERSION = '16.13'
  const [MIN_NODE_MAJOR_VERSION, MIN_NODE_MINOR_VERSION] = extractSemanticVersionParts(MIN_NODE_VERSION)
  const [nodeMajorVersion, nodeMinorVersion] = extractSemanticVersionParts(nodeVersion)

  if (
    nodeMajorVersion < MIN_NODE_MAJOR_VERSION ||
    (nodeMajorVersion === MIN_NODE_MAJOR_VERSION && nodeMinorVersion < MIN_NODE_MINOR_VERSION)
  ) {
    console.error(
      drawBox({
        str: `Prisma only supports Node.js >= ${MIN_NODE_VERSION}.\nPlease upgrade your Node.js version.`,
        height: 2,
        width: 48,
        horizontalPadding: 4,
      }),
    )
    process.exit(1)
  }
}
