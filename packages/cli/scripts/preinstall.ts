import process from 'node:process'

import { drawBox } from '@prisma/internals'

type MajorMinor = `${number}.${number}`
type MajorMinorPatch = `${MajorMinor}.${number}`

export function main() {
  printMessageAndExitIfUnsupportedNodeVersion(process.versions.node as MajorMinorPatch)
}

function extractSemanticVersionParts(version: MajorMinor | MajorMinorPatch) {
  return version
    .split('.')
    .slice(0, 2) // only major and minor version
    .map((v) => Number.parseInt(v, 10)) as [number, number]
}

/**
 * Given a Node.js version (e.g. `v16.13.0`), prints an error and exits the process
 * if the Node.js version is not supported by Prisma.
 */
export function printMessageAndExitIfUnsupportedNodeVersion(nodeVersion: MajorMinorPatch) {
  const [nodeMajorVersion, nodeMinorVersion] = extractSemanticVersionParts(nodeVersion)

  // Minimum Node.js version supported by Prisma
  const MIN_NODE_VERSION = '18.18'
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
