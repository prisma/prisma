import process from 'node:process'

import { drawBox } from '@prisma/internals'

export function main() {
  printMessageAndExitIfUnsupportedNodeVersion(process.version)
}

function extractSemanticVersionParts(version) {
  return version
    .split('.')
    .slice(0, 2) // only major and minor version
    .map((v) => parseInt(v, 10))
}

/**
 * Given a Node.js version (e.g. `v16.13.0`), prints an error and exits the process
 * if the Node.js version is not supported by Prisma.
 */
export function printMessageAndExitIfUnsupportedNodeVersion(nodeVersion) {
  // Node.js version, without the `v` prefix (e.g. `16.13.0`)
  const semanticNodeVersion = nodeVersion.slice(1)
  const [nodeMajorVersion, nodeMinorVersion] = extractSemanticVersionParts(semanticNodeVersion)

  // Minimum Node.js version supported by Prisma
  const MIN_NODE_VERSION = '16.13'
  const [MIN_NODE_MAJOR_VERSION, MIN_NODE_MINOR_VERSION] = extractSemanticVersionParts(MIN_NODE_VERSION)

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
