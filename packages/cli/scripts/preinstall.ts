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
    .map((v) => parseInt(v, 10)) as [number, number]
}

/**
 * Given a Node.js version (e.g. `v16.13.0`), prints an error and exits the process
 * if the Node.js version is not supported by Prisma.
 */
export function printMessageAndExitIfUnsupportedNodeVersion(nodeVersion: MajorMinorPatch) {
  const [nodeMajorVersion, nodeMinorVersion] = extractSemanticVersionParts(nodeVersion)

  // Minimum Node.js versions supported by Prisma
  const MIN_NODE_VERSION_MATRIX: Record<string, string> = {
    '20': '19',
    '22': '12',
    '24': '0',
  }

  if (
    !(nodeMajorVersion in MIN_NODE_VERSION_MATRIX) ||
    nodeMinorVersion < parseInt(MIN_NODE_VERSION_MATRIX[nodeMajorVersion], 10)
  ) {
    const supportedVersions = Object.entries(MIN_NODE_VERSION_MATRIX)
      .map(([major, minor]) => `${major}.${minor}`)
      .join(', ')

    console.error(
      drawBox({
        str: `Prisma only supports Node.js versions ${supportedVersions}.\nPlease upgrade your Node.js version.`,
        height: 2,
        width: 48,
        horizontalPadding: 4,
      }),
    )
    process.exit(1)
  }
}
